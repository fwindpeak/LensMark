import type { TestScene } from '../types/assessment.ts';
import type { Pixels } from './pixels.ts';

export type DemoKind = 'detail' | 'soft' | 'flat' | 'grid';
export const DEMOS: { id: DemoKind; name: string; scene: TestScene }[] = [
  { id: 'detail', name: '清晰与边角差异', scene: 'resolution' },
  { id: 'soft', name: '模糊与噪点', scene: 'general' },
  { id: 'flat', name: '平场暗角', scene: 'flat' },
  { id: 'grid', name: '网格畸变', scene: 'grid' },
];
export const linearToSrgb = (v: number) =>
  255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
function erf(x: number) {
  const sign = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return (
    sign *
    (1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
        t +
        0.254829592) *
        t *
        Math.exp(-x * x))
  );
}
/** Controlled pixel inputs. Every displayed measurement is calculated by the real engine. */
export function demoPixels(kind: DemoKind, w = 960, h = 720): Pixels {
  const data = new Uint8ClampedArray(w * h * 4),
    scale = Math.hypot(w, h) / 2;
  let seed = 42;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed + 1) / 4294967297;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - (w - 1) / 2) / scale,
        dy = (y - (h - 1) / 2) / scale;
      let values: number[];
      if (kind === 'flat')
        values = [0, 1, 2].map(() => 0.5 * 2 ** (-(dx * dx + dy * dy) * 1.2));
      else if (kind === 'grid') {
        const rd = Math.hypot(dx, dy),
          k = -0.045;
        let ru = rd;
        for (let i = 0; i < 8; i++)
          ru -= (ru * (1 + k * ru * ru) - rd) / (1 + 3 * k * ru * ru);
        const xx = (w - 1) / 2 + dx * (rd ? ru / rd : 1) * scale;
        const yy = (h - 1) / 2 + dy * (rd ? ru / rd : 1) * scale;
        const distance = (a: number, s: number) =>
          Math.abs(a - Math.round(a / s) * s);
        const d = Math.min(
          distance(xx - w / 2 - 28, w / 10),
          distance(yy - h / 2 - 28, h / 8),
        );
        values = [0, 1, 2].map(
          () => 0.16 + 0.55 * Math.min(1, Math.max(0, d - 1)),
        );
      } else {
        const col = Math.floor(x / (w / 3)),
          row = Math.floor(y / (h / 3));
        const cx = ((col + 0.5) * w) / 3,
          cy = ((row + 0.5) * h) / 3;
        const sigma =
          kind === 'soft' ? 3.2 : row === 1 && col === 1 ? 1 : 1.5 + 0.2 * row;
        const dist =
          (x - cx - Math.tan((5.7 * Math.PI) / 180) * (y - cy)) /
          Math.sqrt(1 + Math.tan((5.7 * Math.PI) / 180) ** 2);
        values = [0, 1, 2].map(
          (c) =>
            0.12 +
            0.55 *
              (0.5 +
                0.5 *
                  erf(
                    (dist - (c - 1) * (col - 1) * 0.5) / (Math.SQRT2 * sigma),
                  )),
        );
      }
      for (let c = 0; c < 3; c++) {
        const noise =
          kind === 'soft'
            ? Math.sqrt(-2 * Math.log(random())) *
              Math.cos(2 * Math.PI * random()) *
              8
            : 0;
        data[(y * w + x) * 4 + c] = linearToSrgb(values[c]) + noise;
      }
      data[(y * w + x) * 4 + 3] = 255;
    }
  return { data, width: w, height: h };
}
export async function demoImage(kind: DemoKind): Promise<HTMLImageElement> {
  const p = demoPixels(kind),
    canvas = document.createElement('canvas');
  canvas.width = p.width;
  canvas.height = p.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建演示图片');
  const d = ctx.createImageData(p.width, p.height);
  d.data.set(p.data);
  ctx.putImageData(d, 0, 0);
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  await img.decode();
  return img;
}
export function targetSvg(kind: 'resolution' | 'grid'): string {
  const body =
    kind === 'grid'
      ? Array.from(
          { length: 17 },
          (_, i) => `<path d="M ${i * 100} 0 V 1200"/>`,
        ).join('') +
        Array.from(
          { length: 13 },
          (_, i) => `<path d="M 0 ${i * 100} H 1600"/>`,
        ).join('')
      : Array.from({ length: 9 }, (_, i) => {
          const x = (((i % 3) + 0.5) * 1600) / 3,
            y = (Math.floor(i / 3) + 0.5) * 400;
          return `<rect x="${x - 140}" y="${y - 140}" width="280" height="280" fill="#505050" stroke="none" transform="rotate(5.7 ${x} ${y})"/>`;
        }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400mm" height="300mm" viewBox="0 0 1600 1200"><title>LensMark ${kind === 'grid' ? 'straight-line grid' : 'slanted-edge practice target'} — not ISO certified</title><rect width="1600" height="1200" fill="#d2d2d2"/><g fill="none" stroke="#505050" stroke-width="4">${body}</g></svg>`;
}
