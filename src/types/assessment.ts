import type { ROI } from './mtf.ts';

export type TestScene = 'general' | 'resolution' | 'flat' | 'grid';
export type Rating = 'good' | 'fair' | 'poor' | 'unknown';
export interface QualityMetric {
  id: string;
  name: string;
  rating: Rating;
  label: string;
  value: number | null;
  unit: string;
  score: number | null;
  summary: string;
  advice: string;
}
export interface SharpnessSample {
  roi: ROI;
  edgeWidth: number | null;
  edges: number;
}
export interface PhotoAssessment {
  score: number | null;
  rating: Rating;
  title: string;
  summary: string;
  coverage: number;
  metrics: QualityMetric[];
  suggestions: string[];
  sharpness: SharpnessSample[];
  histogram: number[];
}
export interface ZoneMeasurement {
  id: string;
  name: string;
  row: number;
  col: number;
  samples: number;
  mtf50: number | null;
  spread: number | null;
  caPx: number | null;
  roi: ROI | null;
  orientation: 'horizontal' | 'vertical' | null;
}
export interface FlatFieldResult {
  valid: boolean;
  falloffEv: number | null;
  cornersEv: (number | null)[];
  grid: number[];
  asymmetryEv: number | null;
  message: string;
}
export interface DistortionLine {
  axis: 'horizontal' | 'vertical';
  points: { x: number; y: number }[];
}
export interface DistortionResult {
  valid: boolean;
  /** One-parameter radial model, center-to-corner normalized. Not TV distortion. */
  k1: number | null;
  cornerDistortionPct: number | null;
  residualPx: number | null;
  lines: DistortionLine[];
  message: string;
}
export interface LensAssessment {
  scene: TestScene;
  zones: ZoneMeasurement[];
  centerMtf50: number | null;
  edgeMtf50: number | null;
  edgeOrientation: 'horizontal' | 'vertical' | null;
  caPx: number | null;
  flat: FlatFieldResult | null;
  distortion: DistortionResult | null;
}
export interface EvaluationRecord {
  id: string;
  fileName: string;
  thumbnail: string;
  camera: string;
  lens: string;
  aperture: number | null;
  focalLength: number | null;
  iso: number | null;
  width: number;
  height: number;
  source: import('./evaluation.ts').SourceKind;
  scene: TestScene;
  photoScore: number | null;
  scoreCoverage: number;
  sharpnessPx: number | null;
  noiseSigma: number | null;
  highlightsPct: number | null;
  zones: ZoneMeasurement[];
  caPx: number | null;
  falloffEv: number | null;
  distortionPct: number | null;
  createdAt: string;
}
