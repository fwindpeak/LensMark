import { ROI, DetectedEdge } from '../types/mtf';
import { extractLinearGrayscale } from './grayscale';
import { fitSlantedEdge } from './edgeDetection';
import { buildEsfAndLsf } from './esfLsf';
import { computeMtfFromLsf } from './dft';

/**
 * 在全图中自动扫描并识别符合 ISO 12233 规范的高反差倾斜边缘
 */
export function detectSlantedEdges(
  imageSource: CanvasImageSource,
  sourceWidth?: number,
  sourceHeight?: number
): DetectedEdge[] {
  const imgW =
    sourceWidth ||
    (imageSource as HTMLImageElement).naturalWidth ||
    (imageSource as HTMLImageElement).width ||
    800;
  const imgH =
    sourceHeight ||
    (imageSource as HTMLImageElement).naturalHeight ||
    (imageSource as HTMLImageElement).height ||
    600;

  const candidateRois: { roi: ROI; zoneName: string }[] = [];

  // 1. 划分候选检测网格 (5x5 区域采样)
  const cols = 5;
  const rows = 5;
  const boxW = Math.max(60, Math.min(220, Math.floor(imgW / 5)));
  const boxH = Math.max(60, Math.min(220, Math.floor(imgH / 5)));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const centerX = Math.floor(((c + 0.5) * imgW) / cols);
      const centerY = Math.floor(((r + 0.5) * imgH) / rows);

      const x = Math.max(0, Math.min(imgW - boxW, centerX - Math.floor(boxW / 2)));
      const y = Math.max(0, Math.min(imgH - boxH, centerY - Math.floor(boxH / 2)));

      let zoneName = '边缘';
      if (r === 2 && c === 2) zoneName = '中心';
      else if (r <= 1 && c <= 1) zoneName = '左上';
      else if (r <= 1 && c >= 3) zoneName = '右上';
      else if (r >= 3 && c <= 1) zoneName = '左下';
      else if (r >= 3 && c >= 3) zoneName = '右下';
      else if (r === 0) zoneName = '顶部';
      else if (r === 4) zoneName = '底部';
      else if (c === 0) zoneName = '左侧';
      else if (c === 4) zoneName = '右侧';

      candidateRois.push({
        roi: { x, y, w: boxW, h: boxH },
        zoneName,
      });
    }
  }

  // 2. 对每个候选窗口尝试执行斜边拟合与 MTF50 计算
  const detected: DetectedEdge[] = [];

  candidateRois.forEach((cand, idx) => {
    try {
      const { gray, width, height } = extractLinearGrayscale(imageSource, cand.roi);
      const fitted = fitSlantedEdge(gray, width, height);
      if (!fitted) return;

      // 角度适宜性过滤 (建议倾角在 3° ~ 30°)
      if (fitted.angleDeg < 2 || fitted.angleDeg > 35) return;

      // 对比度过滤
      if (fitted.contrast < 0.12) return;

      // 计算 MTF50
      const { lsf } = buildEsfAndLsf(
        gray,
        width,
        height,
        fitted.k,
        fitted.b,
        fitted.isVertical,
        4,
        128
      );
      const { mtf50 } = computeMtfFromLsf(lsf, 4, 64);

      if (mtf50 > 0.05 && mtf50 <= 0.8) {
        detected.push({
          id: `edge_${idx}_${cand.zoneName}`,
          roi: cand.roi,
          angleDeg: Math.round(fitted.angleDeg * 100) / 100,
          isVertical: fitted.isVertical,
          contrast: Math.round(fitted.contrast * 100) / 100,
          mtf50: Math.round(mtf50 * 1000) / 1000,
          zoneName: cand.zoneName,
          score: fitted.contrast * 0.6 + (fitted.validRowCount / fitted.totalRows) * 0.4,
        });
      }
    } catch {
      // 忽略单个窗口的检测异常
    }
  });

  // 3. 区域去重并保留各主要区域最优质的候选斜边
  const zoneGroups = new Map<string, DetectedEdge[]>();
  detected.forEach((d) => {
    const list = zoneGroups.get(d.zoneName) || [];
    list.push(d);
    zoneGroups.set(d.zoneName, list);
  });

  const bestEdges: DetectedEdge[] = [];
  zoneGroups.forEach((edges) => {
    edges.sort((a, b) => b.score - a.score);
    // 每个分区最多保留 1~2 个最强斜边
    bestEdges.push(...edges.slice(0, 1));
  });

  // 按重要度排序：中心优先，随后四角
  const priorityOrder = ['中心', '左上', '右上', '左下', '右下', '顶部', '底部', '左侧', '右侧', '边缘'];
  bestEdges.sort((a, b) => priorityOrder.indexOf(a.zoneName) - priorityOrder.indexOf(b.zoneName));

  return bestEdges;
}
