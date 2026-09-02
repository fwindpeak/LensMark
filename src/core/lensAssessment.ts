import type {
  LensAssessment,
  TestScene,
  ZoneMeasurement,
} from '../types/assessment.ts';
import type { DetectedEdge, ROI } from '../types/mtf.ts';
import { analyzeMtfPixels } from './mtf.ts';
import { grayscale, median } from './pixels.ts';
import type { Pixels } from './pixels.ts';
import {
  measureChromaticShift,
  measureDistortion,
  measureFlatField,
} from './optics.ts';

export type PixelReader = (roi: ROI, outW?: number, outH?: number) => Pixels;
export const ZONE_NAMES = [
  '左上',
  '上方',
  '右上',
  '左侧',
  '中心',
  '右侧',
  '左下',
  '下方',
  '右下',
];
export function scanLens(
  read: PixelReader,
  width: number,
  height: number,
  overview: Pixels,
): { zones: ZoneMeasurement[]; edges: DetectedEdge[] } {
  const g = grayscale(overview, true),
    ow = overview.width,
    oh = overview.height;
  const zones: ZoneMeasurement[] = [],
    edges: DetectedEdge[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const id = row * 3 + col,
        candidates: { x: number; y: number; weight: number }[] = [];
      for (
        let y = Math.max(3, Math.floor((row * oh) / 3));
        y < Math.min(oh - 3, ((row + 1) * oh) / 3);
        y += 3
      ) {
        for (
          let x = Math.max(3, Math.floor((col * ow) / 3));
          x < Math.min(ow - 3, ((col + 1) * ow) / 3);
          x += 3
        ) {
          const gx = g[y * ow + x + 1] - g[y * ow + x - 1],
            gy = g[(y + 1) * ow + x] - g[(y - 1) * ow + x];
          const large = Math.max(Math.abs(gx), Math.abs(gy)),
            small = Math.min(Math.abs(gx), Math.abs(gy));
          if (large > 0.045 && small / large < 0.3)
            candidates.push({
              x: (x * width) / ow,
              y: (y * height) / oh,
              weight: large,
            });
        }
      }
      candidates.sort((a, b) => b.weight - a.weight);
      const picked: typeof candidates = [],
        measured: {
          mtf: number;
          ca: number | null;
          roi: ROI;
          vertical: boolean;
          angle: number;
          residual: number;
        }[] = [];
      for (const p of candidates) {
        if (picked.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 70)) continue;
        picked.push(p);
        if (picked.length > 12 || measured.length >= 3) break;
        for (const size of [96, 160]) {
          if (width < size || height < size) continue;
          const roi = {
            x: Math.max(0, Math.min(width - size, Math.round(p.x - size / 2))),
            y: Math.max(0, Math.min(height - size, Math.round(p.y - size / 2))),
            w: size,
            h: size,
          };
          const pixels = read(roi),
            mtf = analyzeMtfPixels(pixels);
          if (!mtf.isValid || mtf.mtf50 === null) continue;
          const dx = roi.x + size / 2 - width / 2,
            dy = roi.y + size / 2 - height / 2;
          const radius = Math.hypot(dx, dy),
            field = radius / (Math.hypot(width, height) / 2);
          const radialAlignment = radius
            ? Math.abs(mtf.isVerticalEdge ? dx - mtf.k * dy : dy - mtf.k * dx) /
              (radius * Math.sqrt(1 + mtf.k ** 2))
            : 0;
          const ca =
            field >= 0.3 && radialAlignment >= 0.5
              ? measureChromaticShift(pixels, mtf)
              : null;
          measured.push({
            mtf: mtf.mtf50,
            ca,
            roi,
            vertical: !!mtf.isVerticalEdge,
            angle: mtf.angleDeg,
            residual: mtf.fitResidualPx ?? 0,
          });
          break;
        }
      }
      // Don't mix radial/tangential directions into a supposedly comparable number.
      const verticals = measured.filter((m) => m.vertical),
        horizontals = measured.filter((m) => !m.vertical);
      const selected =
        verticals.length >= horizontals.length ? verticals : horizontals;
      const values = selected.map((m) => m.mtf),
        caValues = measured.flatMap((m) => (m.ca === null ? [] : [m.ca]));
      const mid = values.length ? median(values) : null;
      const representative = selected.length
        ? [...selected].sort(
            (a, b) => Math.abs(a.mtf - mid!) - Math.abs(b.mtf - mid!),
          )[0]
        : null;
      zones.push({
        id: String(id),
        name: ZONE_NAMES[id],
        row,
        col,
        samples: values.length,
        mtf50: mid,
        spread:
          values.length > 1 ? Math.max(...values) - Math.min(...values) : null,
        caPx: caValues.length ? median(caValues) : null,
        roi: representative?.roi ?? null,
        orientation: representative
          ? representative.vertical
            ? 'vertical'
            : 'horizontal'
          : null,
      });
      if (representative)
        edges.push({
          id: String(id),
          zoneName: ZONE_NAMES[id],
          roi: representative.roi,
          mtf50: mid,
          angleDeg: representative.angle,
          isVertical: representative.vertical,
          contrast: 0,
          score: 1 / (1 + representative.residual),
        });
    }
  return { zones, edges };
}
export function summarizeLens(
  scene: TestScene,
  zones: ZoneMeasurement[],
  overview: Pixels,
): LensAssessment {
  const corners = zones.filter(
    (z) => z.row !== 1 && z.col !== 1 && z.mtf50 !== null,
  );
  const edgeOrientation =
    zones[4]?.orientation ?? corners[0]?.orientation ?? null;
  const sameDirection = corners.filter(
    (z) => z.orientation === edgeOrientation,
  );
  const ca = zones.flatMap((z) => (z.caPx === null ? [] : [z.caPx]));
  return {
    scene,
    zones,
    centerMtf50: zones[4]?.mtf50 ?? null,
    edgeMtf50: sameDirection.length
      ? median(sameDirection.map((z) => z.mtf50!))
      : null,
    edgeOrientation,
    caPx: ca.length ? median(ca) : null,
    flat: scene === 'flat' ? measureFlatField(overview) : null,
    distortion: scene === 'grid' ? measureDistortion(overview) : null,
  };
}
