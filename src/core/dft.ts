export interface MtfSpectrum {
  mtf: number[];
  mtf50: number; // in cycles/pixel (c/p)
  numFreqs: number;
}

/**
 * 离散傅里叶变换 (DFT) 计算 MTF 频域响应与 MTF50 指标
 */
export function computeMtfFromLsf(
  windowedLsf: number[],
  oversampling = 4,
  numFreqs = 64
): MtfSpectrum {
  const winLen = windowedLsf.length;
  const mtf: number[] = [];
  let dcValue = 0;

  for (let f = 0; f < numFreqs; f++) {
    let re = 0;
    let im = 0;
    const omega = (2 * Math.PI * f) / winLen;

    for (let n = 0; n < winLen; n++) {
      const val = windowedLsf[n];
      re += val * Math.cos(omega * n);
      im -= val * Math.sin(omega * n);
    }

    const mag = Math.sqrt(re * re + im * im);
    if (f === 0) {
      dcValue = mag;
    }
    // 归一化到 DC 分量 (零频 = 1.0)
    mtf.push(dcValue > 0 ? mag / dcValue : 0);
  }

  // 线性插值寻找 MTF=0.5 处的空间频率 (MTF50)
  let mtf50 = 0;
  for (let f = 0; f < numFreqs - 1; f++) {
    if (mtf[f] >= 0.5 && mtf[f + 1] <= 0.5) {
      const ratio = (0.5 - mtf[f]) / (mtf[f + 1] - mtf[f]);
      const freqIdx = f + ratio;
      // 换算为 cycles/pixel
      mtf50 = (freqIdx / winLen) * oversampling;
      break;
    }
  }

  return {
    mtf,
    mtf50,
    numFreqs,
  };
}
