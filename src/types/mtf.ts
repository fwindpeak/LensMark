export type AnalysisMode = 'overview' | 'slanted_edge' | 'photo_quality' | 'lens_performance';

export * from './evaluation';

export interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MTFResult {
  isValid: boolean;
  angleDeg: number;
  k: number;
  b: number;
  isVerticalEdge?: boolean;
  mtf50: number; // in cycles/pixel (c/p)
  mtf: number[]; // MTF values normalized from DC=1.0
  esf: number[]; // 4x oversampled Edge Spread Function
  lsf: number[]; // Windowed Line Spread Function
  winLen: number;
  oversampling: number;
  edgeCount: number;
  totalRows: number;
  errorMessage?: string;
}

export interface ZoneMetric {
  id: 'center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'top' | 'bottom' | 'left' | 'right';
  name: string;
  shortName: string;
  sharpness: number; // 0 ~ 100 综合锐度分
  tenengrad: number;
  laplacianVar: number;
  colorFringingPx: number; // Sub-pixel CA delta in px
  relativeIllumination: number; // 0 ~ 100%
  roi: ROI;
  hasTexture?: boolean; // 该区域是否包含有效结构/焦点纹理
  overshootPct?: number; // 过冲/锐化光晕比例 (%)
}

export interface ChromaticAberrationResult {
  averageCaPx: number; // 平均色散错位宽度 (px)
  maxCaPx: number; // 最大色散错位宽度 (px)
  fringeRatio: number; // 紫边/彩边像素比例 (%)
  grade: '极佳 (无明显色散)' | '良好 (轻微色散)' | '中等 (可见紫边)' | '较重 (明显色边)';
}

export interface VignettingResult {
  centerLuminance: number; // 中心平均亮度
  cornerLuminance: number; // 四角平均亮度
  relativeIlluminationPct: number; // 相对照度 %
  evLoss: number; // 边角曝光损失 EV
  grade: '均匀' | '轻微暗角' | '中等暗角' | '显著暗角';
}

export interface HeatmapGrid {
  cols: number;
  rows: number;
  data: Float32Array; // 归一化 0.0 ~ 1.0 清晰度热力值
  minVal: number;
  maxVal: number;
}

export interface LensQualityResult {
  overallScore: number; // 0 ~ 100 综合得分
  gradeLevel: 'S' | 'A' | 'B' | 'C' | 'D';
  gradeTitle: string; // e.g. "卓越旗舰级"
  
  // 核心分项指标
  centerSharpness: number; // 0 ~ 100
  cornerAvgSharpness: number; // 0 ~ 100
  edgeFalloffPct: number; // 边缘解析力衰减率 (%)
  
  // 计算摄影与真实光学鉴别
  overshootPct: number; // 全图平均边缘过冲率 (%)
  isOversharpened: boolean; // 是否检测到机内计算摄影/过度锐化白边
  lwphEstimate: number; // 估计总画面解析力 (Line Widths / Picture Height)
  textureConfidence: number; // 画面有效可评估纹理置信度 (0~100%)
  
  // 噪声、压缩伪影与物理分辨率约束
  snrDb: number; // 画面信噪比 (dB)
  noiseLevel: '极低噪点' | '正常低噪' | '中等噪点' | '重度高噪' | '极高杂讯';
  blockinessPct: number; // 8x8 JPEG 块效应/马赛克强度 (%)
  resolutionMegapixels: number; // 原图等效百万像素数 (MP)
  isResolutionLimited: boolean; // 是否受限于低分辨率物理瓶颈

  // 分区矩阵 (9 宫格 / 5 关键区)
  zones: ZoneMetric[];
  
  // 色散与暗角
  chromaticAberration: ChromaticAberrationResult;
  vignetting: VignettingResult;
  
  // 热力图数据
  heatmap: HeatmapGrid;
  
  // 智能光学诊断建议
  diagnosisSummary: string;
  recommendations: string[];
}

export interface DetectedEdge {
  id: string;
  roi: ROI;
  angleDeg: number;
  isVertical: boolean;
  contrast: number; // 边缘对比度 (0~1)
  mtf50: number; // 计算所得 MTF50
  zoneName: string; // '中心' | '左上' | '右上' | '左下' | '右下' | '边缘'
  score: number;
}

export interface AnalysisState {
  image: HTMLImageElement | null;
  imageName: string;
  mode: AnalysisMode;
  roi: ROI;
  mtfResult: MTFResult | null;
  lensQualityResult: LensQualityResult | null;
  detectedEdges: DetectedEdge[];
  selectedEdgeId: string | null;
  showHeatmap: boolean;
  heatmapOpacity: number;
  showEdgeBadges: boolean;
  isAnalyzing: boolean;
}
