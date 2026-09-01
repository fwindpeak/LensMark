
import type { AnalysisResult } from '../types/evaluation';
import type { ROI } from '../types/mtf';
import { analyzeMtf } from './mtf';
import { detectSlantedEdges } from './autoEdgeDetector';
import { evaluatePhotoQuality, measureSubject, subjectRoi } from './photoQuality';
import { clampRoi, readPixels } from './pixels';
let image: ImageBitmap | null = null, cached: AnalysisResult | null = null;
self.onmessage = (event: MessageEvent<{ id: number; image?: ImageBitmap; roi: ROI }>) => {
  const { id, roi } = event.data;
  try {
    if (event.data.image) { image?.close(); image = event.data.image; cached = null; }
    if (!image) throw new Error('请先导入图片');
    const r = clampRoi(roi, image.width, image.height), sr = subjectRoi(r, image.width, image.height);
    const photo = cached ? { ...cached.photo, subject: measureSubject(readPixels(image, sr), sr) } : evaluatePhotoQuality(image, image.width, image.height, r);
    cached = { photo, mtf: analyzeMtf(image, r), edges: cached?.edges ?? detectSlantedEdges(image) };
    self.postMessage({ id, result: cached });
  } catch (e) { self.postMessage({ id, error: e instanceof Error ? e.message : '分析失败' }); }
};
