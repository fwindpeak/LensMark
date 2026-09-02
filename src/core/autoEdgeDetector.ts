import type { ROI, DetectedEdge } from '../types/mtf.ts';
import { analyzeMtf } from './mtf.ts';

/**
 * 在全图中自动扫描并识别符合局部测量筛查条件的高反差倾斜边缘
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
  const boxW = Math.min(imgW, Math.max(48, Math.min(180, Math.floor(imgW / 5))));
  const boxH = Math.min(imgH, Math.max(48, Math.min(180, Math.floor(imgH / 5))));

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
      const measured = analyzeMtf(imageSource, cand.roi);
      if (measured.isValid) {
        detected.push({
          id: `edge_${idx}_${cand.zoneName}`,
          roi: cand.roi,
          angleDeg: Math.round(measured.angleDeg * 100) / 100,
          isVertical: !!measured.isVerticalEdge,
          contrast: 0,
          mtf50: measured.mtf50,
          zoneName: cand.zoneName,
          score: 1 / (1 + (measured.fitResidualPx || 0)),
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
