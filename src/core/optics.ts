import type {
  FlatFieldResult,
  DistortionLine,
  DistortionResult,
} from '../types/assessment.ts';
import type { MTFResult } from '../types/mtf.ts';
import { grayscale, median, srgbToLinear } from './pixels.ts';
import type { Pixels } from './pixels.ts';

/** Normalized neutral-edge RGB centroid separation, in pixels normal to the edge. */
export function measureChromaticShift(
  pixels: Pixels,
  mtf: MTFResult,
): number | null {
  if (!mtf.isValid) return null;
  const { width: w, height: h, data } = pixels;
  const vertical = !!mtf.isVerticalEdge,
    rows = vertical ? h : w,
    cols = vertical ? w : h;
  const at = (r: number, x: number, c: number) =>
    srgbToLinear(data[(vertical ? r * w + x : x * w + r) * 4 + c] / 255);
  const shifts: number[][] = [[], []];
  for (let row = 0; row < rows; row += 2) {
    const left = [0, 0, 0],
      right = [0, 0, 0];
    for (let c = 0; c < 3; c++)
      for (let x = 0; x < 8; x++) {
        left[c] += at(row, x, c) / 8;
        right[c] += at(row, cols - 1 - x, c) / 8;
      }
    const neutral = (v: number[]) =>
      Math.max(...v) - Math.min(...v) < 0.02 + Math.max(...v) * 0.18;
    if (!neutral(left) || !neutral(right)) continue;
    const centers: number[] = [];
    for (let c = 0; c < 3; c++) {
      const polarity = Math.sign(right[c] - left[c]);
      if (Math.abs(right[c] - left[c]) < 0.08) break;
      let moment = 0,
        sum = 0;
      const edge = mtf.k * row + mtf.b;
      for (
        let x = Math.max(1, Math.floor(edge - 13));
        x <= Math.min(cols - 2, Math.ceil(edge + 13));
        x++
      ) {
        const d = (polarity * (at(row, x + 1, c) - at(row, x - 1, c))) / 2;
        moment += d * x;
        sum += d;
      }
      if (sum > 0.07) centers.push(moment / sum);
    }
    if (centers.length === 3) {
      shifts[0].push(centers[0] - centers[1]);
      shifts[1].push(centers[2] - centers[1]);
    }
  }
  if (shifts[0].length < rows * 0.3) return null;
  const offset = shifts.map((v) => median(v));
  if (
    shifts.some((s, c) => median(s.map((v) => Math.abs(v - offset[c]))) > 0.35)
  )
    return null;
  const shift = Math.max(...offset.map(Math.abs)) / Math.sqrt(1 + mtf.k ** 2);
  return shift <= 6 ? shift : null;
}

/** Flat-field relative illumination in inverse-sRGB values. Optical attribution needs uniform lighting. */
export function measureFlatField(pixels: Pixels): FlatFieldResult {
  const fail = (message: string): FlatFieldResult => ({
    valid: false,
    falloffEv: null,
    cornersEv: [null, null, null, null],
    grid: [],
    asymmetryEv: null,
    message,
  });
  const { width: w, height: h } = pixels;
  if (Math.min(w, h) < 140) return fail('平场图片至少需要 140×140 像素。');
  const g = grayscale(pixels, true),
    cells: number[] = [],
    roughness: number[] = [];
  let clipped = 0;
  for (let i = 0; i < pixels.data.length; i += 4)
    if (
      pixels.data[i] >= 254 ||
      pixels.data[i + 1] >= 254 ||
      pixels.data[i + 2] >= 254 ||
      g[i / 4] < 0.001
    )
      clipped++;
  if (clipped / g.length > 0.01)
    return fail('平场有过曝或死黑区域，请用中等曝光重拍。');
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 7; col++) {
      const cx = ((col + 0.5) * w) / 7,
        cy = ((row + 0.5) * h) / 7;
      const rx = Math.floor(w / 24),
        ry = Math.floor(h / 24);
      let sum = 0,
        sx = 0,
        sy = 0,
        xx = 0,
        yy = 0,
        n = 0;
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const v = g[(Math.floor(cy) + y) * w + Math.floor(cx) + x];
          sum += v;
          sx += x * v;
          sy += y * v;
          xx += x * x;
          yy += y * y;
          n++;
        }
      const mean = sum / n,
        ax = sx / xx,
        ay = sy / yy;
      let err = 0;
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++)
          err +=
            (g[(Math.floor(cy) + y) * w + Math.floor(cx) + x] -
              mean -
              ax * x -
              ay * y) **
            2;
      cells.push(mean);
      roughness.push(Math.sqrt(err / n) / Math.max(0.01, mean));
    }
  if (median(roughness) > 0.05 || roughness.filter((v) => v > 0.12).length > 5)
    return fail(
      '画面有明显纹理或杂物。请拍满画面的均匀白墙/漫射板，稍微失焦。',
    );
  const center = cells[24];
  if (center < 0.025) return fail('平场曝光太低，请提高曝光并避免高光截断。');
  const grid = cells.map((v) => Math.log2(center / Math.max(0.001, v)));
  const cornersEv = [grid[0], grid[6], grid[42], grid[48]];
  const asymmetryEv = Math.max(...cornersEv) - Math.min(...cornersEv);
  const falloffEv = median(cornersEv);
  if (asymmetryEv > 0.6 || Math.min(...grid) < -0.3)
    return fail(
      '亮度分布明显不均或中心偏暗，光照梯度可能掩盖暗角。请改善均匀照明后重拍。',
    );
  return {
    valid: true,
    falloffEv,
    cornersEv,
    grid,
    asymmetryEv,
    message: `角落采样位置相对中心衰减 ${falloffEv.toFixed(2)} EV。按 sRGB 反变换估计，需均匀照明；机内校正和色调曲线仍会影响结果。`,
  };
}

function regression(points: { x: number; y: number }[], horizontal: boolean) {
  const n = points.length,
    mx = points.reduce((s, p) => s + (horizontal ? p.x : p.y), 0) / n;
  const my = points.reduce((s, p) => s + (horizontal ? p.y : p.x), 0) / n;
  let xx = 0,
    xy = 0;
  for (const p of points) {
    const x = (horizontal ? p.x : p.y) - mx;
    xx += x * x;
    xy += x * ((horizontal ? p.y : p.x) - my);
  }
  const slope = xx ? xy / xx : 0;
  return (
    points.reduce(
      (s, p) =>
        s +
        ((horizontal ? p.y : p.x) -
          my -
          slope * ((horizontal ? p.x : p.y) - mx)) **
          2,
      0,
    ) / n
  );
}

/** Fit r_distorted = r_ideal * (1 + k1*r_ideal^2), with radius normalized to half diagonal.
 * Uses straight-line constraints, which remove line slope/perspective without pretending
 * that a single photo recovers focal length, principal point or complex distortion. */
export function fitRadialDistortion(
  lines: DistortionLine[],
  width: number,
  height: number,
): DistortionResult {
  const fail = (message: string): DistortionResult => ({
    valid: false,
    k1: null,
    cornerDistortionPct: null,
    residualPx: null,
    lines,
    message,
  });
  if (
    lines.length < 4 ||
    !lines.some((l) => l.axis === 'horizontal') ||
    !lines.some((l) => l.axis === 'vertical')
  )
    return fail(
      '需要横、竖两个方向至少 4 条长直线，且覆盖画面外侧。请使用网格样张。',
    );
  const scale = Math.hypot(width, height) / 2,
    cx = (width - 1) / 2,
    cy = (height - 1) / 2;
  const usable = lines.filter(
    (l) =>
      l.points.length >= 12 &&
      l.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
  const outer = usable.filter((l) =>
    l.points.some((p) => Math.hypot(p.x - cx, p.y - cy) / scale > 0.65),
  );
  if (outer.length < 4)
    return fail('外侧直线不足；只有中心网格无法可靠估计畸变。');
  const error = (k: number) => {
    let sum = 0;
    for (const l of usable) {
      const points = l.points.map((p) => {
        const dx = (p.x - cx) / scale,
          dy = (p.y - cy) / scale,
          rd = Math.hypot(dx, dy);
        let ru = rd;
        for (let i = 0; i < 8; i++)
          ru -= (ru * (1 + k * ru * ru) - rd) / (1 + 3 * k * ru * ru);
        const ratio = rd > 0 ? ru / rd : 1;
        return { x: cx + dx * ratio * scale, y: cy + dy * ratio * scale };
      });
      sum += regression(points, l.axis === 'horizontal');
    }
    return sum / usable.length;
  };
  let best = 0,
    bestError = Infinity;
  for (let i = -120; i <= 120; i++) {
    const k = i / 1000,
      e = error(k);
    if (e < bestError) {
      best = k;
      bestError = e;
    }
  }
  const coarse = best;
  for (let k = coarse - 0.001; k <= coarse + 0.001; k += 0.0001) {
    const e = error(k);
    if (e < bestError) {
      bestError = e;
      best = k;
    }
  }
  if (Math.abs(best) > 0.118 || Math.sqrt(bestError) > 1)
    return fail(
      '网格不符合简单径向模型，可能有弯曲目标、强透视、偏心或复杂畸变；不输出误导数值。',
    );
  return {
    valid: true,
    k1: best,
    cornerDistortionPct: best * 100,
    residualPx: Math.sqrt(bestError),
    lines: usable,
    message:
      Math.abs(best) < 0.002
        ? '未检出明显径向弯曲。结果描述当前成片，可能已被机内校正。'
        : `${best < 0 ? '桶形' : '枕形'}趋势；按单参数径向模型估计，拟合残差 ${Math.sqrt(bestError).toFixed(2)} 个分析像素。`,
  };
}

/** Track dark grid lines from the central cross. No metadata or hard-coded distortion values. */
export function measureDistortion(pixels: Pixels): DistortionResult {
  const { width: w, height: h } = pixels,
    gray = grayscale(pixels);
  const lines: DistortionLine[] = [];
  for (const horizontal of [true, false]) {
    const length = horizontal ? w : h,
      extent = horizontal ? h : w;
    const at = (t: number, q: number) =>
      gray[horizontal ? q * w + t : t * w + q];
    const profile: number[] = [];
    for (let q = 0; q < extent; q++) {
      let sum = 0;
      for (let t = Math.floor(length * 0.4); t < Math.floor(length * 0.6); t++)
        sum += at(t, q);
      profile.push(sum / (Math.floor(length * 0.6) - Math.floor(length * 0.4)));
    }
    const seeds: number[] = [];
    for (let q = 8; q < extent - 8; q++) {
      if (
        profile[q] < Math.min(profile[q - 7], profile[q + 7]) - 25 &&
        profile[q] <= profile[q - 1] &&
        profile[q] < profile[q + 1] &&
        (!seeds.length || q - seeds[seeds.length - 1] > 12)
      )
        seeds.push(q);
    }
    for (const seed of seeds.slice(0, 24)) {
      const points: { x: number; y: number }[] = [];
      for (const direction of [-1, 1]) {
        let previous = seed;
        for (
          let t = Math.floor(length / 2);
          t >= length * 0.06 && t <= length * 0.94;
          t += direction * 6
        ) {
          let min = Infinity,
            pos = -1;
          for (
            let q = Math.max(8, Math.round(previous - 6));
            q <= Math.min(extent - 9, Math.round(previous + 6));
            q++
          )
            if (at(t, q) < min) {
              min = at(t, q);
              pos = q;
            }
          if (pos < 0) break;
          const bg = (at(t, pos - 7) + at(t, pos + 7)) / 2;
          if (bg - min < 30) continue; // Crossings are skipped, not followed onto another line.
          let moment = 0,
            weight = 0;
          for (let q = pos - 5; q <= pos + 5; q++) {
            const v = Math.max(0, bg - at(t, q));
            weight += v;
            moment += v * q;
          }
          if (weight <= 0) continue;
          previous = moment / weight;
          points.push(
            horizontal ? { x: t, y: previous } : { x: previous, y: t },
          );
        }
      }
      const ts = points.map((p) => (horizontal ? p.x : p.y));
      if (
        points.length >= length / 12 &&
        Math.max(...ts) - Math.min(...ts) > length * 0.7
      )
        lines.push({ axis: horizontal ? 'horizontal' : 'vertical', points });
    }
  }
  return fitRadialDistortion(lines, w, h);
}
