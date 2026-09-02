
import type { ROI } from '../types/mtf.ts';
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }
export function clampRoi(roi: ROI, width: number, height: number): ROI {
  if (![roi.x, roi.y, roi.w, roi.h, width, height].every(Number.isFinite) || width < 1 || height < 1) {
    throw new Error('图片尺寸或选区无效');
  }
  const x = Math.max(0, Math.min(width - 1, Math.floor(roi.x)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(roi.y)));
  return { x, y, w: Math.max(1, Math.min(width - x, Math.floor(roi.w))), h: Math.max(1, Math.min(height - y, Math.floor(roi.h))) };
}
export function readPixels(source: CanvasImageSource, roi: ROI, outW = roi.w, outH = roi.h): Pixels {
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('浏览器无法创建像素读取画布');
  ctx.drawImage(source, roi.x, roi.y, roi.w, roi.h, 0, 0, outW, outH);
  const pixels = ctx.getImageData(0, 0, outW, outH);
  // Composite transparency against white; invisible RGB must not affect measurements.
  for (let i = 0; i < pixels.data.length; i += 4) {
    const a = pixels.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) pixels.data[i + c] = pixels.data[i + c] * a + 255 * (1 - a);
    pixels.data[i + 3] = 255;
  }
  return pixels;
}
export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
export function grayscale(pixels: Pixels, linear = false): Float64Array {
  const gray = new Float64Array(pixels.width * pixels.height);
  for (let j = 0; j < gray.length; j++) {
    const i = j * 4;
    const convert = (c: number) => linear ? srgbToLinear(pixels.data[i + c] / 255) : pixels.data[i + c];
    gray[j] = 0.2126 * convert(0) + 0.7152 * convert(1) + 0.0722 * convert(2);
  }
  return gray;
}
export function median(values: number[]): number {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y), mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
