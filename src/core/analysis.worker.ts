import type { ROI } from '../types/mtf.ts';
import type { TestScene } from '../types/assessment.ts';
import { AnalysisEngine } from './analysisEngine.ts';
import { readPixels } from './pixels.ts';

let image: ImageBitmap | null = null,
  engine: AnalysisEngine | null = null;
self.onmessage = (
  event: MessageEvent<{
    id: number;
    image?: ImageBitmap;
    roi: ROI | null;
    scene: TestScene;
    subjectOnly?: boolean;
  }>,
) => {
  const { id, roi, scene, subjectOnly } = event.data;
  try {
    if (event.data.image) {
      image?.close();
      image = event.data.image;
      self.postMessage({ id, progress: '检查曝光、噪声与主体轮廓…' });
      engine = new AnalysisEngine(
        (r, w, h) => readPixels(image!, r, w, h),
        image.width,
        image.height,
      );
    }
    if (!engine) throw new Error('请先导入图片');
    self.postMessage({ id, progress: '测量中心、边角与色差…' });
    self.postMessage({ id, result: engine.analyze(roi, scene, subjectOnly) });
  } catch (e) {
    self.postMessage({
      id,
      error: e instanceof Error ? e.message : '分析失败',
    });
  }
};
