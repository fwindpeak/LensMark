
import type { NoiseEstimate, PhotoQualityReport, SubjectDetail } from '../types/evaluation.ts';
import type { ROI } from '../types/mtf.ts';
import { clampRoi, grayscale, median, readPixels } from './pixels.ts';
import type { Pixels } from './pixels.ts';
/** Spatial residual estimate in native-pixel patches, not sensor noise.
 * Reject structure after removing a plane; do not reject a patch merely for high noise.
 */
export function estimateNoise(gray: Float64Array, w: number, h: number): NoiseEstimate {
  const patches: { sigma: number; signal: number }[] = [];
  let candidates = 0;
  const n = 16;
  for (let by = 0; by + n <= h; by += n) for (let bx = 0; bx + n <= w; bx += n) {
    candidates++;
    let mean = 0, sx = 0, sy = 0, denom = 0, clipped = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = gray[(by + y) * w + bx + x];
      mean += v; sx += (x - 7.5) * v; sy += (y - 7.5) * v; denom += (x - 7.5) ** 2;
      if (v <= 2 || v >= 253) clipped++;
    }
    mean /= n * n; sx /= denom; sy /= denom;
    if (mean < 15 || mean > 240 || clipped > 2) continue;
    const residual: number[] = [], quadrants = new Array(16).fill(0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = gray[(by + y) * w + bx + x] - mean - sx * (x - 7.5) - sy * (y - 7.5);
      residual.push(v);
      quadrants[Math.floor(y / 4) * 4 + Math.floor(x / 4)] += v / 16;
    }
    const center = median(residual);
    const sigma = median(residual.map(v => Math.abs(v - center))) / 0.67448975;
    const lowFrequency = Math.sqrt(quadrants.reduce((s, v) => s + v * v, 0) / 16);
    let covariance = 0, variance = 0, pairs = 0;
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const i = y * n + x;
      covariance += residual[i] * (residual[i + 1] + residual[i + n]) / 2;
      variance += residual[i] ** 2; pairs++;
    }
    const corr = variance > 0.01 ? covariance / variance : 0;
    if (Math.hypot(sx, sy) > 1.2 || lowFrequency > Math.max(0.7, sigma * 0.48) || Math.abs(corr) > 0.4 || !pairs) continue;
    patches.push({ sigma, signal: mean });
  }
  if (patches.length < 6) return {
    sigma: null, snrDb: null, patches: patches.length, candidates,
    note: '可用平坦块不足，无法估计噪声；请补拍中等亮度的均匀灰面。缺少样本不等于低噪声。',
  };
  const sigma = median(patches.map(p => p.sigma));
  return {
    sigma, snrDb: sigma >= 0.1 ? median(patches.filter(p => p.sigma >= 0.1).map(p => 20 * Math.log10(p.signal / p.sigma))) : null,
    patches: patches.length, candidates,
    note: sigma < 0.1 ? '残差低于 8-bit 量化精度，不能给出可靠 SNR；降噪和量化也会抹平细节。' : '原像素平坦块去除亮度平面后的 MAD 残差估计；纹理、相关噪声和降噪仍会影响结果。仅描述成片。',
  };
}
export function measureSubject(pixels: Pixels, roi: ROI): SubjectDetail {
  const gray = grayscale(pixels), w = pixels.width, h = pixels.height;
  let grad = 0, lap = 0, lap2 = 0, sum = 0, sum2 = 0, count = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = gray[i];
    const gx = (gray[i + 1] - gray[i - 1]) / 2, gy = (gray[i + w] - gray[i - w]) / 2;
    const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * v;
    grad += gx * gx + gy * gy; lap += l; lap2 += l * l; sum += v; sum2 += v * v; count++;
  }
  count = Math.max(1, count);
  const contrast = Math.sqrt(Math.max(0, sum2 / count - (sum / count) ** 2));
  return { roi, gradientRms: Math.sqrt(grad / count), laplacianVariance: Math.max(0, lap2 / count - (lap / count) ** 2), contrast,
    note: contrast < 3 ? '选区纹理或反差不足，无法凭此判断是否合焦。' : '这些是局部纹理强度，没有通用及格线。噪点、锐化和场景纹理都会抬高数值；不转换为清晰度评分。' };
}
export function subjectRoi(roi: ROI, width: number, height: number): ROI {
  const r = clampRoi(roi, width, height);
  const w = Math.min(512, r.w), h = Math.min(512, r.h);
  return { x: r.x + Math.floor((r.w - w) / 2), y: r.y + Math.floor((r.h - h) / 2), w, h };
}
export function evaluatePhotoQuality(source: CanvasImageSource, width: number, height: number, roi: ROI): PhotoQualityReport {
  const ratio = Math.min(1, 1280 / Math.max(width, height));
  const ow = Math.max(1, Math.round(width * ratio)), oh = Math.max(1, Math.round(height * ratio));
  const pixels = readPixels(source, { x: 0, y: 0, w: width, h: height }, ow, oh);
  const gray = grayscale(pixels);
  let highlights = 0, shadows = 0, sum = 0;
  const clips: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i]; if (gray[i] >= 254) highlights++; if (gray[i] <= 2) shadows++;
    for (let c = 0; c < 3; c++) if (pixels.data[i * 4 + c] >= 254) clips[c]++;
  }
  // Nine disjoint native-pixel tiles, at most 192×192. No resizing of noise samples.
  const tiles: NoiseEstimate[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const tw = Math.max(1, Math.min(192, Math.floor(width / 3))), th = Math.max(1, Math.min(192, Math.floor(height / 3)));
    const tile = readPixels(source, { x: Math.floor((col + 0.5) * width / 3 - tw / 2), y: Math.floor((row + 0.5) * height / 3 - th / 2), w: tw, h: th });
    tiles.push(estimateNoise(grayscale(tile), tw, th));
  }
  const valid = tiles.filter(t => t.sigma !== null);
  const noise: NoiseEstimate = valid.length ? {
    sigma: median(valid.map(t => t.sigma!)),
    snrDb: valid.some(t => t.snrDb !== null) ? median(valid.flatMap(t => t.snrDb === null ? [] : [t.snrDb])) : null,
    patches: valid.reduce((s, t) => s + t.patches, 0), candidates: tiles.reduce((s, t) => s + t.candidates, 0), note: valid[0].note,
  } : { sigma: null, snrDb: null, patches: 0, candidates: tiles.reduce((s, t) => s + t.candidates, 0), note: '原像素采样区中可用平坦块不足，无法估计噪声。请补拍均匀灰面。' };
  const sr = subjectRoi(roi, width, height), subject = measureSubject(readPixels(source, sr), sr);
  const pct = (n: number) => n / gray.length * 100;
  const recommendations = ['先框选你真正关心的主体，再查看原像素细节；背景虚化、天空或白墙不应直接判为画质差。'];
  if (pct(highlights) > 1 || Math.max(...clips.map(pct)) > 3) recommendations.push('部分像素接近通道上限，请查看是否丢失了重要高光；灯具、反光点和纯色背景可能是有意保留的效果。');
  if (noise.sigma === null) recommendations.push('噪声证据不足，不输出“纯净”结论；换用含平坦中间调区域的照片。');
  if (Math.min(width, height) < 600) recommendations.push('图片尺寸较小，建议使用未经缩放的原图；小尺寸本身不能说明镜头差。');
  return { imageDimensions: { width, height }, overviewDimensions: { width: ow, height: oh }, exposure: { mean: sum / gray.length, highlightsPct: pct(highlights), shadowsPct: pct(shadows), channelClippingPct: clips.map(pct) as [number, number, number] }, noise, subject, recommendations };
}
