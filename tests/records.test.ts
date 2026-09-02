import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluationsCsv,
  lensComparisonIssues,
  migrateLegacyRecords,
  parseRecords,
  repeatSummary,
  zoneComparison,
} from '../src/core/evaluationRecords.ts';
import type { EvaluationRecord } from '../src/types/assessment.ts';
import { abortable } from '../src/core/cancellation.ts';

function record(): EvaluationRecord {
  return {
    id: 'a',
    fileName: 'a.jpg',
    thumbnail: '',
    camera: 'Sony A7',
    lens: 'Lens A',
    aperture: 4,
    focalLength: 50,
    iso: 100,
    width: 1000,
    height: 800,
    source: 'rendered',
    scene: 'resolution',
    photoScore: 82,
    scoreCoverage: 1,
    sharpnessPx: 2,
    noiseSigma: 3,
    highlightsPct: 0.1,
    caPx: 0.5,
    falloffEv: null,
    distortionPct: null,
    createdAt: '2026-09-02T00:00:00Z',
    zones: [
      {
        id: '4',
        name: '中心',
        row: 1,
        col: 1,
        samples: 2,
        mtf50: 0.2,
        spread: 0.01,
        caPx: null,
        roi: { x: 450, y: 350, w: 100, h: 100 },
        orientation: 'vertical',
      },
    ],
  };
}
test('Records round-trip and malformed or script-bearing imports cannot corrupt the UI', () => {
  const r = record();
  assert.deepEqual(parseRecords(JSON.stringify({ version: 3, records: [r] })), [
    r,
  ]);
  for (const modified of [
    { ...r, camera: {} },
    { ...r, photoScore: 'NaN' },
    { ...r, width: -1 },
    { ...r, source: 'fake' },
    { ...r, thumbnail: 'javascript:alert(1)' },
    { ...r, zones: [{}] },
  ]) {
    assert.equal(parseRecords(JSON.stringify([modified])).length, 0);
  }
  assert.deepEqual(parseRecords('invalid'), []);
});
test('Comparison has a usable same-body path and detects mismatches', () => {
  const a = record(),
    b = { ...record(), id: 'b', lens: 'Lens B' };
  assert.deepEqual(lensComparisonIssues(a, b, 'lenses'), []);
  assert.ok(lensComparisonIssues(a, { ...b, aperture: 2 }, 'lenses').length);
  assert.deepEqual(
    lensComparisonIssues(a, { ...b, lens: a.lens, aperture: 2 }, 'apertures'),
    [],
  );
  assert.ok(
    lensComparisonIssues(a, { ...b, source: 'synthetic' }, 'lenses').length,
  );
  assert.ok(lensComparisonIssues(a, { ...b, camera: '' }, 'lenses').length);
});
test('Zone deltas compare actual matching field positions and edge directions', () => {
  const a = record(),
    b = record();
  b.zones[0].mtf50 = 0.22;
  assert.ok(Math.abs(zoneComparison(a, b, '4').delta! - 10) < 0.001);
  b.zones[0].orientation = 'horizontal';
  assert.equal(zoneComparison(a, b, '4').delta, null);
  b.zones[0].orientation = 'vertical';
  b.zones[0].roi!.x = 800;
  assert.equal(zoneComparison(a, b, '4').delta, null);
});
test('Repeated measurements report median and spread rather than selecting only the best', () => {
  const records = [0.2, 0.21, 0.19].map((v, i) => {
    const r = record();
    r.id = String(i);
    r.zones[0].mtf50 = v;
    return r;
  });
  const summary = repeatSummary(records, '4');
  assert.equal(summary[0].count, 3);
  assert.equal(summary[0].median, 0.2);
  assert.ok(Math.abs(summary[0].rangePct - 10) < 0.001);
});
test('CSV protects formulas, includes all measurements and preserves missing values', () => {
  const r = record();
  r.fileName = '=HYPERLINK("bad")';
  const csv = evaluationsCsv([r]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /zone8_mtf50/);
  assert.match(csv, /distortionPct/);
  assert.ok(!csv.includes('undefined'));
  assert.ok(!csv.includes('null'));
});
test('Previous local MTF records migrate without losing the original measurement', () => {
  const r = record();
  const migrated = migrateLegacyRecords(
    JSON.stringify([
      { ...r, roi: r.zones[0].roi, orientation: 'vertical', mtf50: 0.2 },
    ]),
  );
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].zones[0].mtf50, 0.2);
  assert.equal(migrated[0].photoScore, null);
});
test('Cancellation settles stalled decoder work and preserves successful results', async () => {
  const c = new AbortController();
  const pending = abortable(new Promise(() => {}), c.signal);
  c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(
    await abortable(Promise.resolve(3), new AbortController().signal),
    3,
  );
  await assert.rejects(abortable(Promise.resolve(3), c.signal), {
    name: 'AbortError',
  });
});
