import { ROI } from '../types/mtf';

/**
 * 从 Canvas 图像源中裁剪指定 ROI，并转换为经过 Gamma 2.2 反变换的物理线性相对光强数组
 */
export function extractLinearGrayscale(
  imageSource: CanvasImageSource,
  roi: ROI
): { gray: Float64Array; width: number; height: number } {
  const rw = Math.max(1, Math.floor(roi.w));
  const rh = Math.max(1, Math.floor(roi.h));
  const rx = Math.floor(roi.x);
  const ry = Math.floor(roi.y);

  const canvas = document.createElement('canvas');
  canvas.width = rw;
  canvas.height = rh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context for ROI cropping');
  }

  ctx.drawImage(imageSource, rx, ry, rw, rh, 0, 0, rw, rh);
  const imgData = ctx.getImageData(0, 0, rw, rh).data;

  const gray = new Float64Array(rw * rh);
  for (let i = 0; i < rw * rh; i++) {
    const r = imgData[i * 4] / 255;
    const g = imgData[i * 4 + 1] / 255;
    const b = imgData[i * 4 + 2] / 255;
    // ITU-R BT.709 亮度加权系数
    const srgb = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Gamma 2.2 逆变换解算真实相对物理光强
    gray[i] = Math.pow(Math.max(0, srgb), 2.2);
  }

  return { gray, width: rw, height: rh };
}
