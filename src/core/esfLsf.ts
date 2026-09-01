export interface EsfLsfData {
  esf: number[];
  lsf: number[];
  oversampling: number;
  winLen: number;
}

/**
 * 依据拟合斜边直线构建 4 倍超采样 ESF，并求导加窗生成 LSF
 */
export function buildEsfAndLsf(
  gray: Float64Array,
  width: number,
  height: number,
  k: number,
  b: number,
  oversampling = 4,
  winLen = 128
): EsfLsfData {
  const maxDist = Math.floor(width / 2);
  const numBins = maxDist * 2 * oversampling;
  const binsSum = new Float64Array(numBins);
  const binsCount = new Int32Array(numBins);

  const cosTheta = Math.cos(Math.atan(k));

  for (let y = 0; y < height; y++) {
    const edgeX = k * y + b;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      // 计算到拟合斜边的法向投影距离
      const dist = (x - edgeX) * cosTheta;
      const binIdx = Math.floor((dist + maxDist) * oversampling);
      if (binIdx >= 0 && binIdx < numBins) {
        binsSum[binIdx] += gray[rowOffset + x];
        binsCount[binIdx]++;
      }
    }
  }

  // 归一化并线性/就近补齐空缺 Bin
  const esf: number[] = [];
  for (let i = 0; i < numBins; i++) {
    if (binsCount[i] > 0) {
      esf.push(binsSum[i] / binsCount[i]);
    } else if (esf.length > 0) {
      esf.push(esf[esf.length - 1]);
    } else {
      esf.push(0);
    }
  }

  // 差分求导获取 LSF (Line Spread Function)
  const lsfLen = esf.length - 1;
  const lsfRaw = new Float64Array(lsfLen);
  let lsfMaxIdx = 0;
  let maxVal = -Infinity;

  for (let i = 0; i < lsfLen; i++) {
    lsfRaw[i] = Math.abs(esf[i + 1] - esf[i]);
    if (lsfRaw[i] > maxVal) {
      maxVal = lsfRaw[i];
      lsfMaxIdx = i;
    }
  }

  // 裁剪以 LSF 峰值为中心的一段有效区域并施加汉宁窗 (Hanning Window)
  const windowedLsf: number[] = new Array(winLen);
  const halfWin = winLen / 2;

  for (let i = 0; i < winLen; i++) {
    const srcIdx = lsfMaxIdx - halfWin + i;
    const rawVal = srcIdx >= 0 && srcIdx < lsfLen ? lsfRaw[srcIdx] : 0;
    // 汉宁窗加权，平滑边缘截断效应
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winLen - 1)));
    windowedLsf[i] = rawVal * w;
  }

  return {
    esf,
    lsf: windowedLsf,
    oversampling,
    winLen,
  };
}
