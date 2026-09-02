
export type AnalysisMode = 'photo_quality' | 'lens_performance' | 'slanted_edge' | 'overview';
export interface ROI { x: number; y: number; w: number; h: number }
export interface MTFResult {
  isValid: boolean; angleDeg: number; k: number; b: number; isVerticalEdge?: boolean;
  mtf50: number | null; mtf: number[]; esf: number[]; lsf: number[];
  winLen: number; oversampling: number; edgeCount: number; totalRows: number;
  errorMessage?: string; warnings?: string[]; fitResidualPx?: number;
}
export interface DetectedEdge {
  id: string; roi: ROI; angleDeg: number; isVertical: boolean; contrast: number;
  mtf50: number | null; zoneName: string; score: number;
}
