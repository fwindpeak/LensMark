
import type { MTFResult, ROI } from '../types/mtf.ts';
import { fitSlantedEdge } from './edgeDetection.ts';
import { buildEsfAndLsf } from './esfLsf.ts';
import { computeMtfFromLsf } from './dft.ts';
import { grayscale, readPixels } from './pixels.ts';
import type { Pixels } from './pixels.ts';
export function invalidMtf(message: string): MTFResult {
  return { isValid: false, angleDeg: 0, k: 0, b: 0, mtf50: null, mtf: [], esf: [], lsf: [], winLen: 256, oversampling: 4, edgeCount: 0, totalRows: 0, errorMessage: message };
}
export function analyzeMtfPixels(pixels: Pixels): MTFResult {
  try {
    const { width, height } = pixels;
    if (width < 48 || height < 48) return invalidMtf('选区至少需要 48×48 原像素，边缘两侧各留约 20 像素');
    const gray = grayscale(pixels, true);
    let clippedCount = 0;
    for (let i = 0; i < pixels.data.length; i++) if (i % 4 !== 3 && (pixels.data[i] <= 1 || pixels.data[i] >= 254)) clippedCount++;
    const clipped = clippedCount / (width * height * 3);
    if (clipped > 0.05) return invalidMtf('选区存在较多通道截断，无法可靠测量；请选择未过曝、未死黑的斜边');
    const fitted = fitSlantedEdge(gray, width, height);
    if (!fitted) return invalidMtf('未找到单一直斜边：请框选倾斜 2°–15°、两侧平坦的明暗交界，避开纹理、曲线和多重边缘');
    const { esf, lsf, oversampling, winLen } = buildEsfAndLsf(gray, width, height, fitted.k, fitted.b, fitted.isVertical);
    const { mtf, mtf50 } = computeMtfFromLsf(lsf, oversampling);
    const warnings = ['结果属于当前选区的成像系统响应，假定输入采用 sRGB 转换曲线；不代表镜头独立 MTF。'];
    if (mtf50 === null) warnings.push('0–0.5 cycles/pixel 内未找到 MTF50 交点，不外推数值或评级。');
    if (Math.max(...mtf) > 1.05) warnings.push('响应超过 1，可能存在锐化或振铃；跨照片比较需固定处理流程。');
    return { isValid: true, ...fitted, isVerticalEdge: fitted.isVertical, mtf50, mtf, esf, lsf, winLen, oversampling, edgeCount: fitted.validRowCount, totalRows: fitted.totalRows, fitResidualPx: fitted.residualPx, warnings };
  } catch (e) { return invalidMtf(e instanceof Error ? e.message : 'MTF 分析失败'); }
}
export function analyzeMtf(source: CanvasImageSource, roi: ROI): MTFResult {
  if (roi.w > 1024 || roi.h > 1024) return invalidMtf('测量选区过大，请缩小至 1024×1024 像素以内的单条斜边');
  return analyzeMtfPixels(readPixels(source, roi));
}
