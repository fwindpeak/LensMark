import type { AnalysisResult } from '../types/evaluation.ts';
import type { ROI } from '../types/mtf.ts';
import type { TestScene } from '../types/assessment.ts';
import { AnalysisEngine } from './analysisEngine.ts';

export class AnalysisClient {
  private worker: Worker | null = null;
  private engine: AnalysisEngine | null = null;
  private image: HTMLImageElement | null = null;
  private version = 0;
  private rejectPending: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  dispose() {
    this.version++;
    this.worker?.terminate();
    this.worker = null;
    this.engine = null;
    this.image = null;
    if (this.timer) clearTimeout(this.timer);
    this.rejectPending?.(new DOMException('已取消', 'AbortError'));
    this.rejectPending = null;
  }
  async run(
    image: HTMLImageElement,
    roi: ROI | null,
    scene: TestScene,
    subjectOnly: boolean,
    progress: (message: string) => void,
  ): Promise<AnalysisResult> {
    this.rejectPending?.(new DOMException('已取消', 'AbortError'));
    this.rejectPending = null;
    if (this.timer) clearTimeout(this.timer);
    const version = ++this.version;
    const check = () => {
      if (version !== this.version)
        throw new DOMException('已取消', 'AbortError');
    };
    const fresh = this.image !== image;
    if (fresh) {
      this.worker?.terminate();
      this.worker = null;
      this.engine = null;
    }
    if (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function'
    ) {
      let bitmap: ImageBitmap | undefined;
      try {
        if (fresh || !this.worker) bitmap = await createImageBitmap(image);
        if (version !== this.version) {
          bitmap?.close();
          check();
        }
        this.worker ??= new Worker(
          new URL('./analysis.worker.ts', import.meta.url),
          { type: 'module' },
        );
        this.image = image;
        return await new Promise<AnalysisResult>((resolve, reject) => {
          this.rejectPending = reject;
          this.timer = setTimeout(() => {
            if (version !== this.version) return;
            this.worker?.terminate();
            this.worker = null;
            this.image = null;
            this.rejectPending = null;
            reject(new Error('分析超时，请缩小图片后重试。'));
          }, 45000);
          this.worker!.onmessage = (
            event: MessageEvent<{
              id: number;
              result?: AnalysisResult;
              error?: string;
              progress?: string;
            }>,
          ) => {
            if (version !== this.version || event.data.id !== version) return;
            if (event.data.progress) {
              progress(event.data.progress);
              return;
            }
            if (this.timer) clearTimeout(this.timer);
            this.rejectPending = null;
            if (event.data.error) reject(new Error(event.data.error));
            else if (event.data.result) resolve(event.data.result);
            else reject(new Error('分析没有返回结果，请重试。'));
          };
          this.worker!.onerror = () => {
            if (version !== this.version) return;
            if (this.timer) clearTimeout(this.timer);
            this.worker?.terminate();
            this.worker = null;
            this.image = null;
            this.rejectPending = null;
            reject(new Error('后台分析加载失败，请重试或更新浏览器。'));
          };
          this.worker!.postMessage(
            { id: version, image: bitmap, roi, scene, subjectOnly },
            bitmap ? [bitmap] : [],
          );
        });
      } catch (error) {
        bitmap?.close();
        if (version === this.version) {
          if (this.timer) clearTimeout(this.timer);
          this.worker?.terminate();
          this.worker = null;
          this.image = null;
          this.rejectPending = null;
        }
        throw error;
      }
    }
    // Compatibility path, no upload or backend dependency. Bounded native samples, never full-resolution copies.
    progress('正在以兼容模式分析…');
    await new Promise((resolve) => setTimeout(resolve, 0));
    check();
    if (!this.engine || fresh) {
      this.image = image;
      this.engine = new AnalysisEngine(
        (r, w = r.w, h = r.h) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('浏览器无法读取图片');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, w, h);
          return ctx.getImageData(0, 0, w, h);
        },
        image.naturalWidth,
        image.naturalHeight,
      );
    }
    check();
    return this.engine.analyze(roi, scene, subjectOnly);
  }
}
