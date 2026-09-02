import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPixels, linearToSrgb } from '../src/core/demoImages.ts';
import { AnalysisEngine } from '../src/core/analysisEngine.ts';
import {
  measureChromaticShift,
  measureFlatField,
  measureDistortion,
  fitRadialDistortion,
} from '../src/core/optics.ts';
import { measureSharpness } from '../src/core/photoAssessment.ts';
import { analyzeMtfPixels } from '../src/core/mtf.ts';
import type { Pixels } from '../src/core/pixels.ts';
import type { PixelReader } from '../src/core/lensAssessment.ts';
import type { DistortionLine } from '../src/types/assessment.ts';

export function pixelReader(p: Pixels): PixelReader {
  return (r, ow = r.w, oh = r.h) => {
    const data = new Uint8ClampedArray(ow * oh * 4);
    for (let y = 0; y < oh; y++)
      for (let x = 0; x < ow; x++) {
        const sx = Math.min(p.width - 1, Math.floor(r.x + (x * r.w) / ow)),
          sy = Math.min(p.height - 1, Math.floor(r.y + (y * r.h) / oh));
        const i = (sy * p.width + sx) * 4;
        data.set(p.data.subarray(i, i + 4), (y * ow + x) * 4);
      }
    return { data, width: ow, height: oh };
  };
}
test('Full workflow: ordinary upload receives photo verdict and independent multi-zone MTF', () => {
  const pixels = demoPixels('detail');
  const result = new AnalysisEngine(
    pixelReader(pixels),
    pixels.width,
    pixels.height,
  ).analyze(null, 'resolution');
  assert.ok(
    result.assessment.score !== null && result.assessment.score > 60,
    JSON.stringify(result.assessment),
  );
  assert.ok(
    result.lens.zones.filter((z) => z.mtf50 !== null).length >= 7,
    JSON.stringify(result.lens.zones),
  );
  assert.ok(result.lens.centerMtf50! > result.lens.edgeMtf50!);
  assert.ok(result.lens.caPx !== null && result.lens.caPx > 0.2);
  assert.equal(result.lens.flat, null);
  assert.equal(result.lens.distortion, null);
});
test('Blurring and adding noise lowers the practical photo score', () => {
  const evaluate = (kind: 'detail' | 'soft') => {
    const p = demoPixels(kind);
    return new AnalysisEngine(pixelReader(p), p.width, p.height).analyze(
      null,
      'general',
    );
  };
  const sharp = evaluate('detail'),
    soft = evaluate('soft');
  assert.ok(soft.assessment.score !== null);
  assert.ok(
    sharp.assessment.score! - soft.assessment.score! > 12,
    `${sharp.assessment.score} vs ${soft.assessment.score}`,
  );
  assert.ok(
    soft.assessment.metrics.find((m) => m.id === 'sharpness')!.rating !==
      'good',
  );
});
test('A flat image never gets a perfect photo score or fabricated lens resolution', () => {
  const p = demoPixels('flat', 320, 240);
  const result = new AnalysisEngine(pixelReader(p), p.width, p.height).analyze(
    null,
    'general',
  );
  assert.equal(result.assessment.score, null);
  assert.equal(result.lens.centerMtf50, null);
  assert.equal(result.lens.flat, null);
  assert.ok(
    result.assessment.metrics.some(
      (m) => m.id === 'exposure' && m.value !== null,
    ),
  );
});
test('Flat-field recovers relative illumination and rejects a structured chart', () => {
  const p = demoPixels('flat'),
    result = measureFlatField(p);
  assert.equal(result.valid, true, result.message);
  assert.ok(result.falloffEv! > 0.8 && result.falloffEv! < 1);
  assert.ok(result.asymmetryEv! < 0.02);
  assert.equal(measureFlatField(demoPixels('detail')).valid, false);
});
test('Chromatic edge shift measures subpixels and rejects a colored subject edge', () => {
  const w = 192,
    h = 192;
  const create = (shift: number, colored = false): Pixels => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++)
          data[(y * w + x) * 4 + c] = linearToSrgb(
            0.15 +
              (colored && c === 0 ? 0.15 : 0.55) *
                (0.5 +
                  0.5 *
                    Math.tanh(
                      (x - 96 - 0.1 * (y - 96) - (c === 0 ? shift : 0)) / 1.5,
                    )),
          );
        data[(y * w + x) * 4 + 3] = 255;
      }
    return { data, width: w, height: h };
  };
  for (const shift of [0, 0.5, 1, 2]) {
    const p = create(shift),
      m = analyzeMtfPixels(p),
      ca = measureChromaticShift(p, m);
    assert.ok(ca !== null && Math.abs(ca - shift) < 0.15, `${shift} -> ${ca}`);
  }
  const colored = create(1, true);
  assert.equal(measureChromaticShift(colored, analyzeMtfPixels(colored)), null);
});
test('Known radial distortion fits barrel, pincushion and undistorted grids', () => {
  const w = 960,
    h = 720,
    scale = Math.hypot(w, h) / 2;
  for (const k of [-0.06, 0, 0.055]) {
    const lines: DistortionLine[] = [];
    for (const axis of ['horizontal', 'vertical'] as const)
      for (const fraction of [0.1, 0.25, 0.75, 0.9]) {
        const points = Array.from({ length: 45 }, (_, i) => {
          const x =
            axis === 'horizontal' ? w * (0.04 + (i / 44) * 0.92) : w * fraction;
          const y =
            axis === 'vertical' ? h * (0.04 + (i / 44) * 0.92) : h * fraction;
          const dx = x - (w - 1) / 2,
            dy = y - (h - 1) / 2,
            factor = 1 + (k * (dx * dx + dy * dy)) / (scale * scale);
          return { x: (w - 1) / 2 + dx * factor, y: (h - 1) / 2 + dy * factor };
        });
        lines.push({ axis, points });
      }
    const result = fitRadialDistortion(lines, w, h);
    assert.equal(result.valid, true, result.message);
    assert.ok(Math.abs(result.k1! - k) < 0.0002);
  }
});
test('Pixel grid detection produces a measured distortion, not only a line-fit demo', () => {
  const result = measureDistortion(demoPixels('grid'));
  assert.equal(result.valid, true, result.message);
  assert.ok(
    Math.abs(result.cornerDistortionPct! + 4.5) < 0.7,
    JSON.stringify(result),
  );
  assert.equal(measureDistortion(demoPixels('flat')).valid, false);
});
test('Tiny images remain usable and sharpness is missing rather than fabricated', () => {
  const p = demoPixels('flat', 2, 1);
  const result = new AnalysisEngine(pixelReader(p), p.width, p.height).analyze(
    null,
    'general',
  );
  assert.equal(result.assessment.score, null);
  assert.equal(measureSharpness(p, { x: 0, y: 0, w: 2, h: 1 }).edgeWidth, null);
});
test('Random noise and broad gradients cannot masquerade as crisp subject edges', () => {
  const w = 192,
    h = 192;
  let seed = 17;
  for (const kind of ['noise', 'gradient']) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v =
          kind === 'noise'
            ? 50 + (seed / 4294967296) * 160
            : 60 + (x / w) * 130;
        for (let c = 0; c < 3; c++) data[(y * w + x) * 4 + c] = v;
        data[(y * w + x) * 4 + 3] = 255;
      }
    assert.equal(
      measureSharpness({ data, width: w, height: h }, { x: 0, y: 0, w, h })
        .edgeWidth,
      null,
    );
  }
});
