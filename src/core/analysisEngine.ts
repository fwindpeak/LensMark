import type {
  AnalysisResult,
  PhotoQualityReport,
} from '../types/evaluation.ts';
import type { ROI, DetectedEdge } from '../types/mtf.ts';
import type {
  SharpnessSample,
  TestScene,
  ZoneMeasurement,
} from '../types/assessment.ts';
import { clampRoi, grayscale } from './pixels.ts';
import type { Pixels } from './pixels.ts';
import { assessPhoto, measureSharpness } from './photoAssessment.ts';
import {
  evaluatePhotoFromReader,
  measureSubject,
  subjectRoi,
} from './photoQuality.ts';
import { scanLens, summarizeLens } from './lensAssessment.ts';
import type { PixelReader } from './lensAssessment.ts';
import { analyzeMtfPixels, invalidMtf } from './mtf.ts';

/** Cached engine shared by the Worker and compatible-browser fallback, tested without a DOM. */
export class AnalysisEngine {
  private overview: Pixels;
  private histogram: number[];
  private samples: SharpnessSample[];
  private photo: PhotoQualityReport;
  private scan: { zones: ZoneMeasurement[]; edges: DetectedEdge[] } | null =
    null;
  private read: PixelReader;
  private width: number;
  private height: number;

  constructor(read: PixelReader, width: number, height: number) {
    this.read = read;
    this.width = width;
    this.height = height;
    const scale = Math.min(1, 960 / Math.max(width, height));
    this.overview = read(
      { x: 0, y: 0, w: width, h: height },
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    this.histogram = new Array(64).fill(0);
    for (const v of grayscale(this.overview))
      this.histogram[Math.min(63, Math.floor(v / 4))]++;
    this.samples = [];
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const w = Math.max(1, Math.min(256, Math.floor(width / 3))),
          h = Math.max(1, Math.min(256, Math.floor(height / 3)));
        const roi = clampRoi(
          {
            x: ((col + 0.5) * width) / 3 - w / 2,
            y: ((row + 0.5) * height) / 3 - h / 2,
            w,
            h,
          },
          width,
          height,
        );
        this.samples.push(measureSharpness(read(roi), roi));
      }
    this.photo = evaluatePhotoFromReader(
      read,
      width,
      height,
      this.samples[4].roi,
    );
  }
  analyze(
    roi: ROI | null,
    scene: TestScene,
    subjectOnly = false,
  ): AnalysisResult {
    this.scan ??= scanLens(this.read, this.width, this.height, this.overview);
    const valid = this.samples
      .filter((s) => s.edgeWidth !== null)
      .sort((a, b) => a.edgeWidth! - b.edgeWidth!);
    const selected = clampRoi(
      roi ??
        this.scan.edges.find((e) => e.zoneName === '中心')?.roi ??
        valid[0]?.roi ??
        this.samples[4].roi,
      this.width,
      this.height,
    );
    const sample = subjectRoi(selected, this.width, this.height),
      pixels = this.read(sample);
    const photo = { ...this.photo, subject: measureSubject(pixels, sample) };
    const sharpness = subjectOnly
      ? [measureSharpness(pixels, sample)]
      : this.samples;
    const mtf =
      selected.w <= 1024 && selected.h <= 1024
        ? analyzeMtfPixels(this.read(selected))
        : invalidMtf(
            'MTF 选区请控制在 1024×1024 原像素以内；照片主体分析仍使用中间最多 512×512 原像素。',
          );
    return {
      photo,
      assessment: assessPhoto(photo, sharpness, this.histogram),
      lens: summarizeLens(scene, this.scan.zones, this.overview),
      mtf,
      edges: this.scan.edges,
      selection: selected,
    };
  }
}
