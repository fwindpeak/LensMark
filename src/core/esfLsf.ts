
export function buildEsfAndLsf(gray: Float64Array, width: number, height: number, k: number, b: number, isVertical = true, oversampling = 4, winLen = 256) {
  const radius = 16, numBins = 2 * radius * oversampling;
  const sums = new Float64Array(numBins), counts = new Uint32Array(numBins);
  const normal = Math.sqrt(1 + k * k);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = (isVertical ? x - k * y - b : y - k * x - b) / normal;
    const bin = Math.floor((distance + radius) * oversampling);
    if (bin >= 0 && bin < numBins) { sums[bin] += gray[y * width + x]; counts[bin]++; }
  }
  if (Array.from(counts).some(c => c === 0)) throw new Error('斜边的亚像素采样覆盖不足，请扩大选区或调整倾角');
  const esf = Array.from(sums, (sum, i) => sum / counts[i]);
  // Keep the sign: abs(derivative) destroys ringing and noise response.
  const raw = esf.slice(1).map((v, i) => v - esf[i]);
  const lsf = new Array(winLen).fill(0);
  const offset = Math.floor((winLen - raw.length) / 2);
  for (let i = 0; i < raw.length; i++) lsf[i + offset] = raw[i] * 0.5 * (1 - Math.cos(2 * Math.PI * i / (raw.length - 1)));
  return { esf, lsf, oversampling, winLen };
}
