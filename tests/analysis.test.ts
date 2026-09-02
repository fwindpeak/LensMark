
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMtfPixels } from '../src/core/mtf.ts';
import { buildEsfAndLsf } from '../src/core/esfLsf.ts';
import { computeMtfFromLsf } from '../src/core/dft.ts';
import { estimateNoise, measureSubject, subjectRoi } from '../src/core/photoQuality.ts';
import { evaluateLensPerformance } from '../src/core/lensPerformance.ts';
import { clampRoi, srgbToLinear } from '../src/core/pixels.ts';
import { comparisonIssues, recordsToCsv } from '../src/core/comparison.ts';
import type { MeasurementRecord } from '../src/types/evaluation.ts';
function erf(x: number) {
  const sign = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x));
}
function image(fn: (x: number, y: number) => number, w = 192, h = 192) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = fn(x, y); data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
const encode = (v: number) => 255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055);
function edge(sigma: number, angle = 5.7, invert = false, horizontal = false) {
  const k = Math.tan(angle * Math.PI / 180);
  return image((x, y) => {
    const d = ((horizontal ? y : x) - 96 - k * ((horizontal ? x : y) - 96)) / Math.sqrt(1 + k * k);
    const step = .5 + .5 * erf(d / (Math.SQRT2 * sigma));
    return encode(.15 + .6 * (invert ? 1 - step : step));
  });
}
function randomNormal(seed = 42) {
  let s = seed;
  const u = () => { s = (1664525 * s + 1013904223) >>> 0; return (s + 1) / 4294967297; };
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
test('Gaussian edges track analytic MTF50 and blur ordering', () => {
  let previous = Infinity;
  for (const sigma of [0.8, 1, 1.5, 2, 3]) {
    const result = analyzeMtfPixels(edge(sigma));
    const expected = Math.sqrt(2 * Math.log(2)) / (2 * Math.PI * sigma);
    assert.equal(result.isValid, true, result.errorMessage);
    assert.ok(result.mtf50 !== null);
    assert.ok(Math.abs(result.mtf50! / expected - 1) < .1, 'sigma=' + sigma + ', expected=' + expected + ', got=' + result.mtf50);
    assert.ok(result.mtf50! < previous); previous = result.mtf50!;
  }
});
test('MTF is consistent across edge polarity and orientation', () => {
  const results = [edge(1.5), edge(1.5, 5.7, true), edge(1.5, 5.7, false, true), edge(1.5, -5.7)].map(analyzeMtfPixels);
  for (const r of results) { assert.equal(r.isValid, true, r.errorMessage); assert.ok(Math.abs(r.mtf50! - results[0].mtf50!) < .005); }
});
test('Flat fields, random noise, multiple edges, curves and axis-aligned edges cannot claim MTF', () => {
  const rand = randomNormal();
  const images = [image(() => 128), image(() => 128 + rand() * 20), image(x => Math.floor(x / 8) % 2 ? 180 : 70), image((x, y) => encode(x > 65 + .003 * y * y ? .7 : .15)), edge(1, 0), edge(1, 25), image(x => x > 96 ? 255 : 0), image(() => 100, 8, 8)];
  for (const p of images) assert.equal(analyzeMtfPixels(p).isValid, false);
});
test('No Nyquist crossing is missing, never zero or an extrapolated number', () => {
  const lsf = Array(256).fill(0); lsf[128] = 1;
  const r = computeMtfFromLsf(lsf);
  assert.equal(r.mtf50, null); assert.equal(r.mtf.length, 33);
  assert.throws(() => computeMtfFromLsf(Array(256).fill(0)));
});
test('LSF preserves negative ringing instead of rectifying it', () => {
  const k = .1, w = 192, h = 192, gray = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (x - 96 - k * (y - 96)) / Math.sqrt(1 + k * k);
    gray[y * w + x] = .2 + .6 / (1 + Math.exp(-d)) + .08 * Math.exp(-(((d - 3) / .8) ** 2));
  }
  const { lsf } = buildEsfAndLsf(gray, w, h, k, 96 - k * 96);
  assert.ok(lsf.some(v => v < -.001));
});
test('High noise is measured, not discarded into a clean fallback', () => {
  for (const sigma of [2, 8, 20]) {
    const random = randomNormal(), gray = Float64Array.from({ length: 192 * 192 }, () => 128 + random() * sigma);
    const r = estimateNoise(gray, 192, 192);
    assert.ok(r.sigma !== null); assert.ok(Math.abs(r.sigma! / sigma - 1) < .15, sigma + ': ' + r.sigma);
  }
});
test('Structured and clipped samples have no noise estimate; uniform field has no fabricated SNR', () => {
  const gray = Float64Array.from({ length: 192 * 192 }, (_, i) => Math.floor((i % 192) / 4) % 2 ? 180 : 60);
  assert.equal(estimateNoise(gray, 192, 192).sigma, null);
  assert.equal(estimateNoise(new Float64Array(192 * 192).fill(255), 192, 192).sigma, null);
  const flat = estimateNoise(new Float64Array(192 * 192).fill(128), 192, 192);
  assert.equal(flat.sigma, 0); assert.equal(flat.snrDb, null);
});
test('ROI clamps bounds and crops native samples without upscaling tiny images', () => {
  assert.deepEqual(clampRoi({ x: 95, y: 90, w: 40, h: 40 }, 100, 100), { x: 95, y: 90, w: 5, h: 10 });
  assert.deepEqual(subjectRoi({ x: 0, y: 0, w: 1000, h: 800 }, 1000, 800), { x: 244, y: 144, w: 512, h: 512 });
  const subject = measureSubject(image(() => 100, 2, 2), { x: 0, y: 0, w: 2, h: 2 });
  assert.ok(Number.isFinite(subject.gradientRms)); assert.equal('subjectScore' in subject, false);
  assert.throws(() => clampRoi({ x: NaN, y: 0, w: 40, h: 40 }, 100, 100));
});
test('sRGB uses the piecewise per-channel inverse transfer function', () => {
  assert.ok(Math.abs(srgbToLinear(.04) - .04 / 12.92) < 1e-12);
  assert.ok(Math.abs(srgbToLinear(.5) - .21404114) < 1e-7);
});
test('Synthetic and RAW sources never invent optical measurements or pass focus checks', () => {
  const mtf = analyzeMtfPixels(edge(1.5));
  for (const source of ['synthetic', 'raw_preview', 'raw_rendered', 'rendered'] as const) {
    const report = evaluateLensPerformance(mtf, source);
    assert.equal(report.resolution.value, mtf.mtf50);
    assert.ok(report.otherMetrics.every(m => m.value === null));
    assert.equal(report.checks[1].status, '未确认');
    assert.equal('mtf50Corner' in report.resolution, false);
  }
});
const record: MeasurementRecord = { id: '1', fileName: 'a.jpg', source: 'rendered', camera: 'camera', lens: 'lens', aperture: 4, focalLength: 50, iso: 100, width: 6000, height: 4000, roi: { x: 2800, y: 1800, w: 200, h: 200 }, mtf50: .2, angle: 5.7, orientation: 'vertical', createdAt: '2026-09-01' };
test('Comparison detects missing metadata, scale, field position and source mismatches', () => {
  assert.deepEqual(comparisonIssues(record, { ...record, lens: 'another lens' }), []);
  for (const changed of [{ camera: '' }, { width: 3000 }, { source: 'raw_preview' as const }, { iso: null }, { roi: { ...record.roi, x: 0 } }, { orientation: 'horizontal' as const }]) assert.ok(comparisonIssues(record, { ...record, ...changed }).length);
});
test('CSV escapes untrusted filenames and preserves missing values', () => {
  const csv = recordsToCsv([{ ...record, fileName: '=1+2', lens: 'a,"b', mtf50: null }]);
  assert.ok(csv.includes('"'+ "'=1+2" + '"')); assert.ok(csv.includes('"a,""b"')); assert.equal(csv.includes('null'), false);
});


test('Welcome slanted-edge demo has a measurable default center ROI', async () => {
  const { slantedEdgePixels } = await import('../src/core/synthetic.ts');
  const { SLANTED_EDGE_PRESET, SAMPLE_PRESETS } = await import('../src/core/sampleImages.ts');
  assert.ok(SAMPLE_PRESETS.includes(SLANTED_EDGE_PRESET));
  const full = slantedEdgePixels();
  const data = new Uint8ClampedArray(220 * 220 * 4);
  for (let y = 0; y < 220; y++) {
    const start = ((y + 90) * full.width + 90) * 4;
    data.set(full.data.subarray(start, start + 220 * 4), y * 220 * 4);
  }
  const result = analyzeMtfPixels({ data, width: 220, height: 220 });
  assert.equal(result.isValid, true, result.errorMessage);
  assert.ok(result.mtf50 !== null && result.mtf50 > 0 && result.mtf50 < .5);
  assert.ok(Math.abs(Math.abs(result.angleDeg) - 5.7) < .2);
});
