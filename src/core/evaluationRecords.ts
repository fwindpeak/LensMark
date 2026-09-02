import type {
  EvaluationRecord,
  TestScene,
  ZoneMeasurement,
} from '../types/assessment.ts';
import type { AnalysisResult, SourceKind } from '../types/evaluation.ts';
import type { ParsedExifResult } from '../types/exif.ts';
import { median } from './pixels.ts';

export const RECORDS_KEY = 'lensmark.evaluations.v3';
const scenes: TestScene[] = ['general', 'resolution', 'flat', 'grid'];
const sources: SourceKind[] = [
  'rendered',
  'raw_rendered',
  'raw_preview',
  'synthetic',
];
const numberOrNull = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isFinite(v));
const text = (v: unknown) => typeof v === 'string' && v.length <= 2000;
export function migrateLegacyRecords(raw: string): EvaluationRecord[] {
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const converted = values
      .filter(
        (r) =>
          r && r.roi && Number.isFinite(r.width) && Number.isFinite(r.height),
      )
      .map((r) => {
        const row = Math.max(
          0,
          Math.min(2, Math.floor(((r.roi.y + r.roi.h / 2) / r.height) * 3)),
        );
        const col = Math.max(
          0,
          Math.min(2, Math.floor(((r.roi.x + r.roi.w / 2) / r.width) * 3)),
        );
        return {
          id: r.id,
          fileName: r.fileName,
          thumbnail: '',
          camera: r.camera,
          lens: r.lens,
          aperture: r.aperture,
          focalLength: r.focalLength,
          iso: r.iso,
          width: r.width,
          height: r.height,
          source: r.source,
          scene: 'resolution',
          createdAt: r.createdAt,
          photoScore: null,
          scoreCoverage: 0,
          sharpnessPx: null,
          noiseSigma: null,
          highlightsPct: null,
          caPx: null,
          falloffEv: null,
          distortionPct: null,
          zones: [
            {
              id: String(row * 3 + col),
              name: '旧版局部测量',
              row,
              col,
              samples: 1,
              mtf50: r.mtf50,
              spread: null,
              caPx: null,
              roi: r.roi,
              orientation: r.orientation,
            },
          ],
        };
      });
    return parseRecords(JSON.stringify(converted));
  } catch {
    return [];
  }
}
export function parseRecords(raw: string): EvaluationRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw),
      values = Array.isArray(parsed)
        ? parsed
        : (parsed as { records?: unknown })?.records;
    if (!Array.isArray(values)) return [];
    return values
      .filter((r): r is EvaluationRecord => {
        if (!r || typeof r !== 'object') return false;
        if (
          !['id', 'fileName', 'camera', 'lens', 'createdAt'].every((k) =>
            text(r[k]),
          )
        )
          return false;
        if (
          !Number.isFinite(Date.parse(r.createdAt)) ||
          !sources.includes(r.source) ||
          !scenes.includes(r.scene)
        )
          return false;
        if (
          !Number.isInteger(r.width) ||
          r.width < 1 ||
          !Number.isInteger(r.height) ||
          r.height < 1 ||
          r.width * r.height > 100_000_000
        )
          return false;
        if (
          ![
            'aperture',
            'focalLength',
            'iso',
            'photoScore',
            'sharpnessPx',
            'noiseSigma',
            'caPx',
            'falloffEv',
            'distortionPct',
          ].every((k) => numberOrNull(r[k]))
        )
          return false;
        if (
          !Number.isFinite(r.scoreCoverage) ||
          r.scoreCoverage < 0 ||
          r.scoreCoverage > 1
        )
          return false;
        if (
          !numberOrNull(r.highlightsPct) ||
          (r.highlightsPct !== null &&
            (r.highlightsPct < 0 || r.highlightsPct > 100)) ||
          (r.photoScore !== null && (r.photoScore < 0 || r.photoScore > 100))
        )
          return false;
        if (
          typeof r.thumbnail !== 'string' ||
          r.thumbnail.length > 100_000 ||
          (r.thumbnail &&
            !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(
              r.thumbnail,
            ))
        )
          return false;
        return (
          Array.isArray(r.zones) &&
          r.zones.length <= 9 &&
          r.zones.every(
            (z: ZoneMeasurement) =>
              z &&
              text(z.id) &&
              text(z.name) &&
              Number.isInteger(z.row) &&
              z.row >= 0 &&
              z.row <= 2 &&
              Number.isInteger(z.col) &&
              z.col >= 0 &&
              z.col <= 2 &&
              Number.isInteger(z.samples) &&
              z.samples >= 0 &&
              numberOrNull(z.spread) &&
              numberOrNull(z.caPx) &&
              numberOrNull(z.mtf50) &&
              (z.mtf50 === null || (z.mtf50 > 0 && z.mtf50 <= 0.5)) &&
              [null, 'horizontal', 'vertical'].includes(z.orientation) &&
              (z.roi === null ||
                [z.roi.x, z.roi.y, z.roi.w, z.roi.h].every(Number.isFinite)),
          )
        );
      })
      .slice(0, 50)
      .filter(
        (record, index, valid) =>
          valid.findIndex((r) => r.id === record.id) === index,
      );
  } catch {
    return [];
  }
}
export function makeRecord(
  result: AnalysisResult,
  info: {
    id: string;
    name: string;
    source: SourceKind;
    scene: TestScene;
    exif: ParsedExifResult | null;
    thumbnail: string;
  },
): EvaluationRecord {
  const m = info.exif?.overview;
  return {
    id: info.id,
    fileName: info.name,
    thumbnail: info.thumbnail,
    source: info.source,
    scene: info.scene,
    camera: m?.model ?? '',
    lens: m?.lensModel ?? '',
    aperture: m?.fNumber ?? null,
    focalLength: m?.focalLength ?? null,
    iso: m?.iso ?? null,
    width: result.photo.imageDimensions.width,
    height: result.photo.imageDimensions.height,
    photoScore: result.assessment.score,
    scoreCoverage: result.assessment.coverage,
    sharpnessPx:
      result.assessment.metrics.find((m) => m.id === 'sharpness')?.value ??
      null,
    noiseSigma: result.photo.noise.sigma,
    highlightsPct: result.photo.exposure.highlightsPct,
    zones: result.lens.zones,
    caPx: result.lens.caPx,
    falloffEv: result.lens.flat?.falloffEv ?? null,
    distortionPct: result.lens.distortion?.cornerDistortionPct ?? null,
    createdAt: new Date().toISOString(),
  };
}
export function lensComparisonIssues(
  a: EvaluationRecord,
  b: EvaluationRecord,
  compare: 'lenses' | 'apertures',
): string[] {
  const issues: string[] = [];
  if (
    !a.camera.trim() ||
    !b.camera.trim() ||
    a.camera.trim() !== b.camera.trim()
  )
    issues.push('机身不同或未填写');
  if (!a.lens.trim() || !b.lens.trim()) issues.push('请填写镜头');
  if (compare === 'apertures' && a.lens.trim() !== b.lens.trim())
    issues.push('比较光圈需同一镜头');
  if (
    !a.aperture ||
    !b.aperture ||
    (compare === 'lenses' && a.aperture !== b.aperture)
  )
    issues.push('光圈不同或未填写');
  if (
    !a.focalLength ||
    !b.focalLength ||
    Math.abs(a.focalLength - b.focalLength) > 0.5
  )
    issues.push('焦距不同或未填写');
  if (!a.iso || !b.iso || a.iso !== b.iso) issues.push('ISO 不同或未填写');
  if (a.width !== b.width || a.height !== b.height) issues.push('像素尺寸不同');
  if (
    a.source !== b.source ||
    ['raw_preview', 'synthetic'].includes(a.source) ||
    ['raw_preview', 'synthetic'].includes(b.source)
  )
    issues.push('需相同来源的实拍原图');
  if (a.scene !== b.scene) issues.push('样张类型不同');
  return issues;
}
export function zoneComparison(
  a: EvaluationRecord,
  b: EvaluationRecord,
  id: string,
): { delta: number | null; reason: string } {
  const za = a.zones.find((z) => z.id === id),
    zb = b.zones.find((z) => z.id === id);
  if (!za?.mtf50 || !zb?.mtf50 || !za.roi || !zb.roi)
    return { delta: null, reason: '该位置缺少解析力测量' };
  if (!za.orientation || za.orientation !== zb.orientation)
    return { delta: null, reason: '该位置边缘方向不同' };
  const ax = (za.roi.x + za.roi.w / 2) / a.width,
    ay = (za.roi.y + za.roi.h / 2) / a.height;
  const bx = (zb.roi.x + zb.roi.w / 2) / b.width,
    by = (zb.roi.y + zb.roi.h / 2) / b.height;
  if (Math.hypot(ax - bx, ay - by) > 0.05)
    return { delta: null, reason: '该位置的取样点偏移较大' };
  return { delta: (zb.mtf50 / za.mtf50 - 1) * 100, reason: '' };
}
export function repeatSummary(records: EvaluationRecord[], zoneId: string) {
  const groups = new Map<string, EvaluationRecord[]>();
  for (const r of records) {
    if (
      !r.camera ||
      !r.lens ||
      !r.aperture ||
      !r.focalLength ||
      !r.iso ||
      ['synthetic', 'raw_preview'].includes(r.source)
    )
      continue;
    const key = [
      r.camera,
      r.lens,
      r.aperture,
      r.focalLength,
      r.iso,
      r.width,
      r.height,
      r.source,
      r.scene,
    ].join('|');
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.values()].flatMap((group) => {
    const compatible = group.filter(
      (r) => zoneComparison(group[0], r, zoneId).delta !== null,
    );
    const values = compatible.map(
      (r) => r.zones.find((z) => z.id === zoneId)!.mtf50!,
    );
    if (values.length < 2) return [];
    const mid = median(values);
    return [
      {
        label: `${group[0].lens} · f/${group[0].aperture}`,
        count: values.length,
        median: mid,
        rangePct: ((Math.max(...values) - Math.min(...values)) / mid) * 100,
      },
    ];
  });
}
export function evaluationsCsv(records: EvaluationRecord[]): string {
  const fields = [
    'fileName',
    'camera',
    'lens',
    'aperture',
    'focalLength',
    'iso',
    'width',
    'height',
    'source',
    'scene',
    'photoScore',
    'scoreCoverage',
    'sharpnessPx',
    'noiseSigma',
    'highlightsPct',
    'caPx',
    'falloffEv',
    'distortionPct',
    'createdAt',
  ] as const;
  const cell = (value: unknown) => {
    const s = String(value ?? '');
    return (
      '"' + (/^[=+\-@\t\r\n]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
    );
  };
  const headers = [
    ...fields,
    ...Array.from({ length: 9 }, (_, i) => `zone${i}_mtf50`),
    ...Array.from({ length: 9 }, (_, i) => `zone${i}_orientation`),
  ];
  return (
    '\ufeff' +
    [
      headers.join(','),
      ...records.map((r) =>
        [
          ...fields.map((k) => r[k]),
          ...Array.from(
            { length: 9 },
            (_, i) => r.zones.find((z) => z.id === String(i))?.mtf50,
          ),
          ...Array.from(
            { length: 9 },
            (_, i) => r.zones.find((z) => z.id === String(i))?.orientation,
          ),
        ]
          .map(cell)
          .join(','),
      ),
    ].join('\r\n')
  );
}
