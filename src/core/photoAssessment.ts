import type { PhotoQualityReport } from '../types/evaluation.ts';
import type {
  PhotoAssessment,
  QualityMetric,
  Rating,
  SharpnessSample,
} from '../types/assessment.ts';
import type { ROI } from '../types/mtf.ts';
import { grayscale, median } from './pixels.ts';
import type { Pixels } from './pixels.ts';

const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const ratingFor = (score: number | null): Rating =>
  score === null
    ? 'unknown'
    : score >= 75
      ? 'good'
      : score >= 50
        ? 'fair'
        : 'poor';
export function interpolateScore(
  value: number,
  anchors: [number, number][],
): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i],
      [x0, y0] = anchors[i - 1];
    if (value <= x) return y0 + ((y - y0) * (value - x0)) / (x - x0);
  }
  return anchors[anchors.length - 1][1];
}

/** Native-pixel 10–90% edge transition width. Does not treat gradient energy as quality.
 * Average along the edge, check plateaus and monotonicity, reject texture/noise/corners.
 * This is a practical rendered-photo heuristic, not MTF or a learned aesthetic model. */
export function measureSharpness(pixels: Pixels, roi: ROI): SharpnessSample {
  const gray = grayscale(pixels, true),
    w = pixels.width,
    h = pixels.height;
  const at = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    return (
      gray[iy * w + ix] * (1 - fx) * (1 - fy) +
      gray[iy * w + ix + 1] * fx * (1 - fy) +
      gray[(iy + 1) * w + ix] * (1 - fx) * fy +
      gray[(iy + 1) * w + ix + 1] * fx * fy
    );
  };
  const widths: number[] = [];
  for (let y = 17; y < h - 17; y += 5)
    for (let x = 17; x < w - 17; x += 5) {
      if (widths.length >= 160) break;
      const gx = gray[y * w + x + 1] - gray[y * w + x - 1];
      const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
      const magnitude = Math.hypot(gx, gy);
      if (magnitude < 0.018) continue;
      const nx = gx / magnitude,
        ny = gy / magnitude;
      const p: number[] = [];
      for (let s = -24; s <= 24; s++) {
        let sum = 0;
        for (let t = -2; t <= 2; t++)
          sum += at(x + (nx * s) / 2 - ny * t, y + (ny * s) / 2 + nx * t);
        p.push(sum / 5);
      }
      const left = median(p.slice(0, 6)),
        right = median(p.slice(-6)),
        contrast = right - left;
      if (contrast < 0.08 || left < 0.002 || right > 0.99) continue;
      const plateau = Math.sqrt(
        [
          ...p.slice(0, 6).map((v) => (v - left) ** 2),
          ...p.slice(-6).map((v) => (v - right) ** 2),
        ].reduce((a, b) => a + b, 0) / 12,
      );
      if (plateau > contrast * 0.09) continue;
      let variation = 0;
      for (let i = 1; i < p.length; i++) variation += Math.abs(p[i] - p[i - 1]);
      if (variation > contrast * 1.28) continue;
      const cross = (fraction: number) => {
        const target = left + contrast * fraction;
        for (let i = 1; i < p.length; i++)
          if (p[i - 1] < target && p[i] >= target)
            return (i - 1 + (target - p[i - 1]) / (p[i] - p[i - 1])) / 2;
        return NaN;
      };
      const lo = cross(0.1),
        mid = cross(0.5),
        hi = cross(0.9),
        width = hi - lo;
      // The examined pixel must belong to this edge; don't count a nearby edge repeatedly.
      if (Math.abs(mid - 12) <= 3 && width >= 0.5 && width <= 15)
        widths.push(width);
    }
  return {
    roi,
    edgeWidth: widths.length >= 4 ? median(widths) : null,
    edges: widths.length,
  };
}

export function assessPhoto(
  report: PhotoQualityReport,
  sharpness: SharpnessSample[],
  histogram: number[],
): PhotoAssessment {
  const usable = sharpness.filter((s) => s.edgeWidth !== null);
  // Median across the sharper half of structured regions avoids grading intentional background blur.
  const sorted = usable.map((s) => s.edgeWidth!).sort((a, b) => a - b);
  const edgeWidth = sorted.length
    ? median(sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2))))
    : null;
  const sharpScore =
    edgeWidth === null
      ? null
      : interpolateScore(edgeWidth, [
          [1, 100],
          [2, 88],
          [3, 68],
          [4.5, 43],
          [7, 15],
          [12, 0],
        ]);
  const e = report.exposure,
    sigma = report.noise.sigma;
  const exposureScore = clamp(
    100 -
      e.highlightsPct * 3 -
      e.shadowsPct * 1.4 -
      Math.max(...e.channelClippingPct) * 0.35,
  );
  const noiseScore =
    sigma === null
      ? null
      : interpolateScore(sigma, [
          [0, 100],
          [2, 95],
          [5, 80],
          [10, 55],
          [20, 20],
          [35, 0],
        ]);
  let total = histogram.reduce((a, b) => a + b, 0);
  const percentile = (p: number) => {
    let sum = 0;
    for (let i = 0; i < histogram.length; i++) {
      sum += histogram[i];
      if (sum >= total * p) return (i * 255) / (histogram.length - 1);
    }
    return 255;
  };
  total = Math.max(1, total);
  const tonalRange = percentile(0.95) - percentile(0.05);
  const metrics: QualityMetric[] = [
    {
      id: 'sharpness',
      name: '清晰度',
      value: edgeWidth,
      unit: 'px 边缘宽度',
      score: sharpScore,
      rating: ratingFor(sharpScore),
      label:
        sharpScore === null
          ? '需要确认主体'
          : sharpScore >= 75
            ? '细节清晰'
            : sharpScore >= 50
              ? '略显柔和'
              : '存在模糊风险',
      summary:
        edgeWidth === null
          ? '未找到足够稳定的轮廓，不能把天空、纯色或虚化背景当成失焦。'
          : `在 ${usable.length} 处有效区域检测轮廓，较清晰区域的过渡宽度为 ${edgeWidth.toFixed(1)} px。`,
      advice:
        edgeWidth === null
          ? '点选有纹理的主体检查，或上传包含清晰轮廓的原图。'
          : sharpScore! < 75
            ? '放大核对主体；重拍时检查对焦、快门速度和景深。'
            : '轮廓表现较好；仍可用 100% 原图检查眼睛或关键细节。',
    },
    {
      id: 'exposure',
      name: '曝光保留',
      value: e.highlightsPct,
      unit: '% 高光截断',
      score: exposureScore,
      rating: ratingFor(exposureScore),
      label:
        exposureScore >= 75
          ? '截断较少'
          : exposureScore >= 50
            ? '有细节损失'
            : '截断较多',
      summary: `接近纯白 ${e.highlightsPct.toFixed(1)}%，接近纯黑 ${e.shadowsPct.toFixed(1)}%。`,
      advice:
        exposureScore < 75
          ? '检查这些区域是否包含重要主体；高光丢失可降低曝光，阴影过重可补光。'
          : '未发现大面积截断；亮度是否合适仍取决于拍摄意图。',
    },
    {
      id: 'noise',
      name: '画面纯净度',
      value: sigma,
      unit: 'σ / 255',
      score: noiseScore,
      rating: ratingFor(noiseScore),
      label:
        noiseScore === null
          ? '纹理干扰较多'
          : noiseScore >= 75
            ? '噪点较轻'
            : noiseScore >= 50
              ? '可见噪点'
              : '噪点明显',
      summary:
        sigma === null
          ? '没有足够平坦的中间调区域，暂不把纹理误判成噪声。'
          : `从 ${report.noise.patches} 个平坦块估计，亮度残差 σ = ${sigma.toFixed(2)}。`,
      advice:
        noiseScore === null
          ? '可选取墙面、皮肤以外的均匀背景等中间调区域补测。'
          : noiseScore < 75
            ? '增加光照、降低 ISO 或适量降噪；注意保留纹理。'
            : '当前成片残差较低，不等于传感器本身的噪声性能。',
    },
    {
      id: 'tone',
      name: '明暗层次',
      value: tonalRange,
      unit: '/ 255',
      score: null,
      rating: tonalRange < 35 ? 'fair' : 'good',
      label:
        tonalRange < 35
          ? '反差较低'
          : tonalRange > 210
            ? '反差较强'
            : '层次适中',
      summary: `5%–95% 亮度范围 ${tonalRange.toFixed(0)} / 255；描述成片，不是传感器动态范围。`,
      advice:
        tonalRange < 35
          ? '如非雾景或刻意低反差，可调整黑白场与局部对比度。'
          : '根据风格调整；黑白画面和低饱和照片不会因此扣分。',
    },
  ];
  const weighted = [
    [sharpScore, 0.45],
    [exposureScore, 0.3],
    [noiseScore, 0.25],
  ] as const;
  const coverage = weighted.reduce(
    (s, [v, weight]) => s + (v === null ? 0 : weight),
    0,
  );
  const score =
    sharpScore === null
      ? null
      : Math.round(
          weighted.reduce((s, [v, weight]) => s + (v ?? 0) * weight, 0) /
            coverage,
        );
  const problems = metrics.filter(
    (m) => m.rating === 'poor' || m.rating === 'fair',
  );
  const rating =
    score === null
      ? problems.some((m) => m.rating === 'poor')
        ? 'poor'
        : 'unknown'
      : ratingFor(score);
  return {
    score,
    rating,
    coverage,
    metrics,
    sharpness,
    histogram,
    title:
      rating === 'good'
        ? '成片技术表现良好'
        : rating === 'fair'
          ? '基本可用，有改善空间'
          : rating === 'poor'
            ? '建议先处理明显问题'
            : '曝光已检查，请确认主体细节',
    summary: problems.length
      ? problems.map((m) => `${m.name}：${m.label}`).join('；')
      : score === null
        ? '尚不足以评价清晰度，但仍可查看曝光、噪声和层次结果。'
        : '已测项目未发现明显问题。这个分数评价技术表现，不评价题材、构图和审美。',
    suggestions: [
      ...problems.map((m) => m.advice),
      ...metrics.filter((m) => m.rating === 'unknown').map((m) => m.advice),
    ].slice(0, 3),
  };
}
