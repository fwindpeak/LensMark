import LibRaw, { type LibRawSettings } from 'libraw-wasm';
import exifr from 'exifr';
import { ParsedExifResult, ExifOverview } from '../types/exif';
import {
  parsePhotoExif,
  formatExposureTime,
  estimateSensorFormat,
} from './exifReader';
import { abortable } from './cancellation';

/**
 * 常见相机厂商 RAW 照片文件扩展名列表
 */
export const RAW_FILE_EXTENSIONS = [
  '.arw', // Sony
  '.cr2', // Canon
  '.cr3', // Canon
  '.nef', // Nikon
  '.nrw', // Nikon
  '.dng', // Adobe Digital Negative / Leica / DJI / Smartphone RAW
  '.raf', // Fujifilm
  '.orf', // Olympus / OM System
  '.rw2', // Panasonic Lumix
  '.pef', // Pentax
  '.srw', // Samsung
  '.3fr', // Hasselblad
  '.mef', // Mamiya
  '.mrw', // Minolta
  '.raw', // Generic RAW
];

/**
 * 判断指定文件是否为 RAW 格式照片
 */
export function isRawFile(fileOrName: File | string): boolean {
  const name = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
  if (!name) return false;
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return RAW_FILE_EXTENSIONS.includes(ext);
}

export interface RawDecodeProgressCallback {
  (message: string, progress?: number): void;
}

export interface RawDecodeResult {
  image: HTMLImageElement;
  width: number;
  height: number;
  exifResult: ParsedExifResult | null;
  decoderInfo: string;
  sourceKind: 'raw_rendered' | 'raw_preview';
}

/**
 * 将 LibRaw 解码的 RGB 像素阵列转为 HTMLImageElement
 */
function rawPixelsToImage(
  data: Uint8Array | Uint16Array,
  width: number,
  height: number,
  bits = 8,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width * height > 100_000_000 ||
        data.length !== width * height * 3
      ) {
        throw new Error('RAW 解码尺寸或像素长度无效');
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('Canvas 2D context creation failed');
      }

      const imgData = ctx.createImageData(width, height);
      const rgba = imgData.data;

      if (bits === 16) {
        // 16-bit 线性下采样至 8-bit 显示
        for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
          rgba[j] = (data[i] >> 8) & 0xff; // R
          rgba[j + 1] = (data[i + 1] >> 8) & 0xff; // G
          rgba[j + 2] = (data[i + 2] >> 8) & 0xff; // B
          rgba[j + 3] = 255; // A
        }
      } else {
        // 8-bit RGB -> RGBA
        for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
          rgba[j] = data[i]; // R
          rgba[j + 1] = data[i + 1]; // G
          rgba[j + 2] = data[i + 2]; // B
          rgba[j + 3] = 255; // A
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (err) => {
        reject(new Error('Failed to load decoded RAW canvas image: ' + err));
      };
      img.src = canvas.toDataURL('image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 降级方案：从 RAW 文件中直接提取内嵌全尺寸相机预览
 */
async function fallbackExtractRawPreview(
  file: File,
  parsedExif: ParsedExifResult | null,
  signal?: AbortSignal,
): Promise<RawDecodeResult> {
  // 1. 尝试使用 exifr 提取内嵌的 thumbnail / preview
  try {
    const thumbBuffer = await abortable(exifr.thumbnail(file), signal);
    if (thumbBuffer && thumbBuffer.byteLength > 0) {
      const blob = new Blob([thumbBuffer], { type: 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(image);
        };
        image.onerror = (e) => {
          URL.revokeObjectURL(blobUrl);
          reject(e);
        };
        image.src = blobUrl;
      });

      return {
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        exifResult: parsedExif,
        sourceKind: 'raw_preview',
        decoderInfo: `RAW 内嵌 JPEG 预览 (${img.naturalWidth}×${img.naturalHeight})`,
      };
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('Failed to extract exifr thumbnail:', err);
  }

  // 2. 搜索并提取 RAW 二进制流中的主 JPEG 流 (SOI: 0xFF, 0xD8 ... EOI: 0xFF, 0xD9)
  const arrayBuffer = await abortable(file.arrayBuffer(), signal);
  const bytes = new Uint8Array(arrayBuffer);

  let largestJpegBlob: Blob | null = null;
  let maxJpegSize = 0;

  // 扫描前 30MB 寻找最大的 JPEG 数据块
  const scanLimit = Math.min(bytes.length - 4, 30 * 1024 * 1024);
  let i = 0;
  while (i < scanLimit) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      const startIndex = i;
      let j = startIndex + 4;
      while (j < scanLimit - 1) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          const length = j + 2 - startIndex;
          if (length > 80 * 1024 && length > maxJpegSize) {
            maxJpegSize = length;
            largestJpegBlob = new Blob([bytes.subarray(startIndex, j + 2)], {
              type: 'image/jpeg',
            });
          }
          i = j + 2;
          break;
        }
        j++;
      }
      // A truncated stream must not rescan the remaining file for every SOI marker.
      if (j >= scanLimit - 1) break;
    }
    i++;
  }

  if (largestJpegBlob) {
    const blobUrl = URL.createObjectURL(largestJpegBlob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(image);
      };
      image.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        reject(e);
      };
      image.src = blobUrl;
    });

    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      exifResult: parsedExif,
      sourceKind: 'raw_preview',
      decoderInfo: `RAW 内嵌 JPEG 预览 (${img.naturalWidth}×${img.naturalHeight})`,
    };
  }

  throw new Error('未能从该 RAW 文件中解析到有效图像数据');
}

/**
 * 通过 LibRaw + WebAssembly 解码 RAW 格式照片
 * 支持多线程 Web Worker 解码，不阻塞 UI 主线程
 */
export async function decodeRawImage(
  file: File,
  onProgress?: RawDecodeProgressCallback,
  settings?: Partial<LibRawSettings>,
  signal?: AbortSignal,
): Promise<RawDecodeResult> {
  onProgress?.('正在读取 RAW 文件二进制数据...', 10);
  const arrayBuffer = await abortable(file.arrayBuffer(), signal);
  const fileBytes = new Uint8Array(arrayBuffer);

  // 1. 同时尝试利用 exifr 提取原生 RAW EXIF 元数据
  onProgress?.('正在解析 RAW EXIF 光学元数据...', 20);
  let parsedExif: ParsedExifResult | null = null;
  try {
    parsedExif = await abortable(parsePhotoExif(file), signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn(
      'Exifr parse failed for RAW file, will fallback to LibRaw metadata:',
      err,
    );
  }

  // 2. 初始化 LibRaw WebAssembly 解码器 (Worker 模式)
  onProgress?.('正在初始化 LibRaw WebAssembly 解码内核...', 35);
  let raw: LibRaw | null = null;
  const release = () => {
    try {
      raw?.dispose();
    } catch {
      /* Already disposed. */
    }
  };
  signal?.addEventListener('abort', release, { once: true });

  try {
    try {
      raw = new LibRaw();
    } catch (workerErr) {
      console.warn(
        'LibRaw Worker creation failed, falling back to embedded preview extraction:',
        workerErr,
      );
      onProgress?.('解码不可用，正在尝试提取内嵌 JPEG 预览...', 60);
      return await fallbackExtractRawPreview(file, parsedExif, signal);
    }

    // 3. 打开并载入 RAW 文件
    onProgress?.('LibRaw 正在载入传感器 Raw 采样数据...', 50);
    const decodeSettings: LibRawSettings = {
      useCameraWb: true, // 使用相机记录的机内白平衡
      useCameraMatrix: 1, // 应用相机原生色彩校准矩阵
      outputColor: 1, // sRGB 色彩空间
      outputBps: 8, // 8-bit 输出
      halfSize: false, // 保持全尺寸传感器分辨率
      noAutoBright: true, // 固定亮度流程，避免逐图自动提亮
      gamm: [2.4, 12.92], // sRGB 曲线；wrapper 将 power 转为倒数
      ...settings,
    };

    await abortable(raw.open(fileBytes, decodeSettings), signal);

    // 4. 提取 LibRaw 内部丰富元数据以补全 EXIF
    try {
      const meta = (await abortable(raw.metadata(true), signal)) as
        | Record<string, any>
        | undefined;
      if (meta) {
        const make = String(meta.make || '');
        const model = String(meta.model || '');
        const lensObj = meta.lens as Record<string, any> | undefined;
        const makernotes = lensObj?.makernotes as
          | Record<string, any>
          | undefined;
        const otherObj = meta.other as Record<string, any> | undefined;

        const lensModel = String(lensObj?.Lens || makernotes?.Lens || '');
        const fNumber = (otherObj?.aperture || lensObj?.CurAp || undefined) as
          | number
          | undefined;
        const focalLength = (otherObj?.focal_len ||
          lensObj?.CurFocal ||
          undefined) as number | undefined;
        const iso = otherObj?.iso_speed as number | undefined;
        const exposureTime = otherObj?.shutter as number | undefined;
        const focalLengthIn35mm = (lensObj?.FocalLengthIn35mmFormat ||
          undefined) as number | undefined;

        if (!parsedExif) {
          const overview: ExifOverview = {
            make,
            model,
            lensModel,
            fNumber,
            focalLength,
            focalLengthIn35mm,
            iso,
            exposureTime,
            exposureTimeString: formatExposureTime(exposureTime),
            sensorFormatEstimate: estimateSensorFormat(
              focalLength,
              focalLengthIn35mm,
              model,
            ),
            software: 'LibRaw WebAssembly Decoder',
          };

          parsedExif = {
            hasExif: true,
            overview,
            rawTags: [],
            sections: [
              {
                name: 'raw',
                label: 'RAW 解码信息',
                tags: [
                  { name: 'Decoder', value: 'LibRaw WebAssembly' },
                  { name: 'Camera', value: `${make} ${model}`.trim() },
                  { name: 'Lens', value: lensModel },
                ],
              },
            ],
            rawJsonString: JSON.stringify(meta, null, 2),
            fullDataMap: meta,
          };
        } else if (!parsedExif.overview.lensModel && lensModel) {
          parsedExif.overview.lensModel = lensModel;
        }
      }
    } catch (metaErr) {
      if (signal?.aborted) throw metaErr;
      console.warn('Failed to fetch LibRaw metadata:', metaErr);
    }

    // 5. 提取去马赛克后的 RGB 像素
    onProgress?.('LibRaw 正在执行 Demosaic 去马赛克与色彩解算...', 70);
    const imgData = await abortable(raw.imageData(), signal);

    if (!imgData || !imgData.data || imgData.data.length === 0) {
      throw new Error('LibRaw failed to return decoded image data');
    }

    onProgress?.('正在渲染高质量显示图层与光学像素映射...', 90);
    const imgElement = await abortable(
      rawPixelsToImage(
        imgData.data,
        imgData.width,
        imgData.height,
        imgData.bits,
      ),
      signal,
    );

    onProgress?.('RAW 照片解析完成！', 100);

    return {
      image: imgElement,
      width: imgData.width,
      height: imgData.height,
      exifResult: parsedExif,
      sourceKind: 'raw_rendered',
      decoderInfo: `LibRaw WebAssembly (${imgData.width}×${imgData.height}, ${imgData.bits}-bit)`,
    };
  } catch (decodeErr) {
    if (signal?.aborted) throw decodeErr;
    console.warn(
      'LibRaw decoding encountered an error, falling back to embedded full preview:',
      decodeErr,
    );
    onProgress?.('RAW 解码失败，正在尝试提取内嵌 JPEG 预览...', 60);
    return await fallbackExtractRawPreview(file, parsedExif, signal);
  } finally {
    signal?.removeEventListener('abort', release);
    // 释放 Worker 与 WebAssembly 内存
    if (raw) {
      try {
        raw.dispose();
      } catch {}
    }
  }
}
