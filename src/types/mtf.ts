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

export interface AnalysisState {
  image: HTMLImageElement | null;
  imageName: string;
  roi: ROI;
  result: MTFResult | null;
  isAnalyzing: boolean;
}
