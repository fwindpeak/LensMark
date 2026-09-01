export interface FittedLine {
  k: number;
  b: number;
  angleDeg: number;
  isVertical: boolean; // true: x = k*y + b (near-vertical), false: y = k*x + b (near-horizontal)
  edgePoints: { x: number; y: number }[];
  validRowCount: number;
  totalRows: number;
  contrast: number;
}

/**
 * 自适应检测斜边（自动识别近垂直或近水平斜边），并使用稳健最小二乘拟合直线
 */
export function fitSlantedEdge(
  gray: Float64Array,
  width: number,
  height: number
): FittedLine | null {
  // 1. 尝试近垂直斜边 (x = k*y + b)
  const vertFit = fitVerticalSlantedEdge(gray, width, height);

  // 2. 尝试近水平斜边 (y = k*x + b)
  const horizFit = fitHorizontalSlantedEdge(gray, width, height);

  if (vertFit && horizFit) {
    // 比较对比度与有效检测点比例，选择拟合质量更优的一个
    return vertFit.contrast * (vertFit.validRowCount / vertFit.totalRows) >=
      horizFit.contrast * (horizFit.validRowCount / horizFit.totalRows)
      ? vertFit
      : horizFit;
  }

  return vertFit || horizFit;
}

/**
 * 拟合近垂直斜边：按行计算水平方向导数质心
 */
function fitVerticalSlantedEdge(
  gray: Float64Array,
  width: number,
  height: number
): FittedLine | null {
  const edgePoints: { x: number; y: number }[] = [];
  let totalContrastSum = 0;

  for (let y = 0; y < height; y++) {
    let maxGrad = 0;
    let sumWeight = 0;
    let sumPos = 0;

    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const grad = Math.abs(gray[rowOffset + (x + 1)] - gray[rowOffset + (x - 1)]);
      if (grad > 0.04) {
        sumWeight += grad;
        sumPos += x * grad;
      }
      if (grad > maxGrad) {
        maxGrad = grad;
      }
    }

    if (sumWeight > 0 && maxGrad > 0.06) {
      const edgeCentroidX = sumPos / sumWeight;
      edgePoints.push({ x: edgeCentroidX, y });
      totalContrastSum += maxGrad;
    }
  }

  if (edgePoints.length < height * 0.35 || edgePoints.length < 5) {
    return null;
  }

  let sumY = 0;
  let sumX = 0;
  let sumYY = 0;
  let sumYX = 0;
  const N = edgePoints.length;

  for (let i = 0; i < N; i++) {
    const { x, y } = edgePoints[i];
    sumY += y;
    sumX += x;
    sumYY += y * y;
    sumYX += y * x;
  }

  const denom = N * sumYY - sumY * sumY;
  if (Math.abs(denom) < 1e-9) {
    return null;
  }

  const k = (N * sumYX - sumY * sumX) / denom;
  const b = (sumX - k * sumY) / N;
  const angleDeg = Math.abs((Math.atan(k) * 180) / Math.PI);

  // 倾角在合理的近垂直范围 (如 2° ~ 35°)
  if (angleDeg > 45) {
    return null;
  }

  return {
    k,
    b,
    angleDeg,
    isVertical: true,
    edgePoints,
    validRowCount: edgePoints.length,
    totalRows: height,
    contrast: totalContrastSum / edgePoints.length,
  };
}

/**
 * 拟合近水平斜边：按列计算垂直方向导数质心
 */
function fitHorizontalSlantedEdge(
  gray: Float64Array,
  width: number,
  height: number
): FittedLine | null {
  const edgePoints: { x: number; y: number }[] = [];
  let totalContrastSum = 0;

  for (let x = 0; x < width; x++) {
    let maxGrad = 0;
    let sumWeight = 0;
    let sumPos = 0;

    for (let y = 1; y < height - 1; y++) {
      const grad = Math.abs(gray[(y + 1) * width + x] - gray[(y - 1) * width + x]);
      if (grad > 0.04) {
        sumWeight += grad;
        sumPos += y * grad;
      }
      if (grad > maxGrad) {
        maxGrad = grad;
      }
    }

    if (sumWeight > 0 && maxGrad > 0.06) {
      const edgeCentroidY = sumPos / sumWeight;
      edgePoints.push({ x, y: edgeCentroidY });
      totalContrastSum += maxGrad;
    }
  }

  if (edgePoints.length < width * 0.35 || edgePoints.length < 5) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  const N = edgePoints.length;

  for (let i = 0; i < N; i++) {
    const { x, y } = edgePoints[i];
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denom = N * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) {
    return null;
  }

  const k = (N * sumXY - sumX * sumY) / denom;
  const b = (sumY - k * sumX) / N;
  const angleDeg = Math.abs((Math.atan(k) * 180) / Math.PI);

  if (angleDeg > 45) {
    return null;
  }

  return {
    k,
    b,
    angleDeg,
    isVertical: false,
    edgePoints,
    validRowCount: edgePoints.length,
    totalRows: width,
    contrast: totalContrastSum / edgePoints.length,
  };
}
