
export function computeMtfFromLsf(windowedLsf: number[], oversampling = 4, numFreqs = 64): { mtf: number[]; mtf50: number | null; numFreqs: number } {
  if (!windowedLsf.length || windowedLsf.some(v => !Number.isFinite(v))) throw new Error('无效的边缘响应');
  const winLen = windowedLsf.length, mtf: number[] = [];
  const dc = Math.abs(windowedLsf.reduce((s, v) => s + v, 0));
  if (dc < 1e-8) throw new Error('边缘直流响应不足');
  const count = Math.min(numFreqs, Math.floor(0.5 * winLen / oversampling) + 1);
  for (let f = 0; f < count; f++) {
    let re = 0, im = 0;
    for (let n = 0; n < winLen; n++) {
      const phase = 2 * Math.PI * f * n / winLen;
      re += windowedLsf[n] * Math.cos(phase); im -= windowedLsf[n] * Math.sin(phase);
    }
    const x = Math.PI * f / winLen, correction = f === 0 ? 1 : x / Math.sin(x);
    mtf.push(Math.hypot(re, im) / dc * correction);
  }
  let mtf50: number | null = null;
  for (let f = 1; f < mtf.length; f++) if (mtf[f - 1] >= 0.5 && mtf[f] < 0.5) {
    mtf50 = (f - 1 + (mtf[f - 1] - 0.5) / (mtf[f - 1] - mtf[f])) * oversampling / winLen; break;
  }
  return { mtf, mtf50, numFreqs: count };
}
