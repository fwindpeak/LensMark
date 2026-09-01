
export interface FittedLine {
  k: number; b: number; angleDeg: number; isVertical: boolean;
  validRowCount: number; totalRows: number; contrast: number; residualPx: number;
}
/** Single straight near-axis edge with stable plateaus. Heuristic gates, not ISO certification. */
export function fitSlantedEdge(gray: Float64Array, width: number, height: number): FittedLine | null {
  const fits = [fitAxis(gray, width, height, true), fitAxis(gray, width, height, false)].filter((f): f is FittedLine => !!f);
  return fits.sort((a, b) => a.residualPx - b.residualPx)[0] ?? null;
}
function fitAxis(gray: Float64Array, width: number, height: number, vertical: boolean): FittedLine | null {
  const rows = vertical ? height : width, cols = vertical ? width : height;
  if (rows < 48 || cols < 48) return null;
  const at = (row: number, col: number) => gray[vertical ? row * width + col : col * width + row];
  const points: { row: number; pos: number }[] = [];
  let contrastSum = 0, polaritySum = 0;
  for (let row = 0; row < rows; row++) {
    let left = 0, right = 0;
    for (let x = 0; x < 8; x++) { left += at(row, x) / 8; right += at(row, cols - 1 - x) / 8; }
    const contrast = Math.abs(right - left), polarity = Math.sign(right - left);
    if (contrast < 0.1) continue;
    let plateauVariance = 0, totalVariation = 0, peak = 0, peakPos = 0;
    for (let x = 0; x < 8; x++) plateauVariance += ((at(row, x) - left) ** 2 + (at(row, cols - 1 - x) - right) ** 2) / 16;
    if (Math.sqrt(plateauVariance) > contrast * 0.1) continue;
    for (let x = 1; x < cols - 1; x++) {
      const grad = (at(row, x + 1) - at(row, x - 1)) / 2;
      totalVariation += Math.abs(grad);
      if (Math.abs(grad) > peak) { peak = Math.abs(grad); peakPos = x; }
    }
    if (peak < 0.008 || totalVariation > contrast * 1.65 || peakPos < 18 || peakPos > cols - 19) continue;
    let weight = 0, moment = 0;
    for (let x = Math.max(1, peakPos - 12); x <= Math.min(cols - 2, peakPos + 12); x++) {
      const v = Math.max(0, polarity * (at(row, x + 1) - at(row, x - 1)) / 2);
      weight += v; moment += v * x;
    }
    if (weight <= 0) continue;
    points.push({ row, pos: moment / weight }); contrastSum += contrast; polaritySum += polarity;
  }
  if (points.length < rows * 0.8 || Math.abs(polaritySum) < points.length * 0.95) return null;
  const n = points.length;
  const mr = points.reduce((s, p) => s + p.row, 0) / n, mp = points.reduce((s, p) => s + p.pos, 0) / n;
  const k = points.reduce((s, p) => s + (p.row - mr) * (p.pos - mp), 0) / points.reduce((s, p) => s + (p.row - mr) ** 2, 0);
  const b = mp - k * mr, angleDeg = Math.abs(Math.atan(k) * 180 / Math.PI);
  const residualPx = Math.sqrt(points.reduce((s, p) => s + (p.pos - k * p.row - b) ** 2, 0) / n);
  if (angleDeg < 2 || angleDeg > 15 || residualPx > 0.6) return null;
  if (Math.min(b, b + k * (rows - 1)) < 17 || Math.max(b, b + k * (rows - 1)) > cols - 18) return null;
  return { k, b, angleDeg, isVertical: vertical, validRowCount: n, totalRows: rows, contrast: contrastSum / n, residualPx };
}
