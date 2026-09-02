
import type { ROI, MTFResult } from './mtf.ts';
export type SourceKind = 'rendered' | 'raw_rendered' | 'raw_preview' | 'synthetic';
export const SOURCE_LABELS: Record<SourceKind, string> = {
  rendered: '已渲染图片（JPEG / PNG / WebP 等）',
  raw_rendered: 'RAW 解码后的 8-bit sRGB 图像',
  raw_preview: 'RAW 内嵌 JPEG 预览（非原始像素）',
  synthetic: '合成演示图（不代表真实镜头）',
};
export interface NoiseEstimate {
  sigma: number | null; snrDb: number | null; patches: number; candidates: number; note: string;
}
export interface SubjectDetail {
  roi: ROI; gradientRms: number; laplacianVariance: number; contrast: number; note: string;
}
export interface PhotoQualityReport {
  imageDimensions: { width: number; height: number };
  overviewDimensions: { width: number; height: number };
  exposure: { mean: number; highlightsPct: number; shadowsPct: number; channelClippingPct: [number, number, number] };
  noise: NoiseEstimate; subject: SubjectDetail; recommendations: string[];
}
export interface OpticalMetric {
  name: string; status: '局部系统测量' | '无法评价'; value: number | null; unit: string; evidence: string; required: string;
}
export interface LensPerformanceReport {
  resolution: OpticalMetric; otherMetrics: OpticalMetric[];
  checks: { title: string; evidence: string; status: '已检查' | '未确认' }[];
  disclaimer: string;
}
export interface AnalysisResult { photo: PhotoQualityReport; mtf: MTFResult; edges: import('./mtf.ts').DetectedEdge[] }
export interface MeasurementRecord {
  id: string; fileName: string; source: SourceKind; camera: string; lens: string;
  aperture: number | null; focalLength: number | null; iso: number | null;
  width: number; height: number; roi: ROI; mtf50: number | null; angle: number;
  orientation: 'horizontal' | 'vertical'; createdAt: string;
}
