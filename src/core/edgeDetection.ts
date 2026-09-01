export interface FittedLine {
  k: number;
  b: number;
  angleDeg: number;
  edgePoints: { x: number; y: number }[];
  validRowCount: number;
  totalRows: number;
}

/**
 * 估计每一行的边缘中心 (Centroid of Derivative)，并用最小二乘法拟合直线 x = k*y + b
 */
export function fitSlantedEdge(
  gray: Float64Array,
  width: number,
  height: number
): FittedLine | null {
  const edgePoints: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    let maxGrad = 0;
    let sumWeight = 0;
    let sumPos = 0;

    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const grad = Math.abs(gray[rowOffset + (x + 1)] - gray[rowOffset + (x - 1)]);
      if (grad > 0.05) {
        // 过滤平坦区噪点
        sumWeight += grad;
        sumPos += x * grad;
      }
      if (grad > maxGrad) {
        maxGrad = grad;
      }
    }

    if (sumWeight > 0 && maxGrad > 0.08) {
      const edgeCentroidX = sumPos / sumWeight;
      edgePoints.push({ x: edgeCentroidX, y });
    }
  }

  // 如果有效检测行数不足 50%，认为边缘反差过低或选区不合理
  if (edgePoints.length < height * 0.4 || edgePoints.length < 5) {
    return null;
  }

  // 最小二乘法拟合直线方程 x = k*y + b
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

  return {
    k,
    b,
    angleDeg,
    edgePoints,
    validRowCount: edgePoints.length,
    totalRows: height,
  };
}
