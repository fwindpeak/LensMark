import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { ROI, DetectedEdge } from '../types/mtf';
import { clampRoi } from '../core/pixels';
export function ImageWorkspace({
  image,
  roi,
  onRoiChange,
  onDropFiles,
  edges,
  onSelectEdge,
  sampleRoi,
  onAuto,
  subjectOnly,
}: {
  image: HTMLImageElement;
  roi: ROI;
  onRoiChange: (r: ROI) => void;
  onDropFiles: (f: File[]) => void;
  edges: DetectedEdge[];
  onSelectEdge: (e: DetectedEdge) => void;
  sampleRoi?: ROI;
  onAuto: () => void;
  subjectOnly: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    crop = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState(roi),
    [showCrop, setShowCrop] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [exposureOverlay, setExposureOverlay] = useState(false);
  useEffect(() => {
    setDraft(roi);
  }, [roi]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    c.width = Math.max(1, Math.round(image.naturalWidth * scale));
    c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, 0, 0, c.width, c.height);
    if (exposureOverlay) {
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const y =
          0.2126 * pixels.data[i] +
          0.7152 * pixels.data[i + 1] +
          0.0722 * pixels.data[i + 2];
        if (
          Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) >=
          254
        ) {
          pixels.data[i] = 255;
          pixels.data[i + 1] = 64;
          pixels.data[i + 2] = 105;
        } else if (y <= 2) {
          pixels.data[i] = 57;
          pixels.data[i + 1] = 134;
          pixels.data[i + 2] = 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
    }
  }, [image, exposureOverlay]);
  useEffect(() => {
    const c = crop.current;
    if (!c || !showCrop) return;
    const r = sampleRoi ?? roi;
    c.width = Math.min(512, r.w);
    c.height = Math.min(512, r.h);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, r.x, r.y, c.width, c.height, 0, 0, c.width, c.height);
  }, [image, roi, showCrop, sampleRoi]);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(
          0,
          Math.min(
            image.naturalWidth - 1,
            ((e.clientX - b.left) / b.width) * image.naturalWidth,
          ),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(
            image.naturalHeight - 1,
            ((e.clientY - b.top) / b.height) * image.naturalHeight,
          ),
        ),
      ),
    };
  };
  const selection = (p: { x: number; y: number }): ROI => ({
    x: Math.min(start.current!.x, p.x),
    y: Math.min(start.current!.y, p.y),
    w: Math.max(1, Math.abs(p.x - start.current!.x)),
    h: Math.max(1, Math.abs(p.y - start.current!.y)),
  });
  const finish = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!start.current) return;
    const p = point(e),
      r = selection(p);
    start.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (selecting && r.w >= 8 && r.h >= 8) onRoiChange(r);
    else if (r.w < 12 && r.h < 12)
      onRoiChange(
        clampRoi(
          { x: p.x - 128, y: p.y - 128, w: 256, h: 256 },
          image.naturalWidth,
          image.naturalHeight,
        ),
      );
    else setDraft(roi);
  };
  return (
    <section
      className="workspace"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length)
          onDropFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="workspace-toolbar">
        <span>
          <b>{image.naturalWidth} × {image.naturalHeight}</b> px ·{' '}
          {subjectOnly ? '已选主体' : '全图自动采样'}
        </span>
        <div className="button-row">
          <button
            onClick={() => setExposureOverlay((v) => !v)}
            aria-pressed={exposureOverlay}
          >
            曝光风险
          </button>
          <button
            onClick={() => setShowCrop((v) => !v)}
            aria-pressed={showCrop}
          >
            {showCrop ? '收起' : '查看'} 100% 原像素
          </button>
          <button onClick={onAuto}>自动分析全图</button>
          <button
            onClick={() => setSelecting((v) => !v)}
            aria-pressed={selecting}
          >
            手动框选
          </button>
        </div>
      </div>
      <p className="workspace-hint">
        {selecting
          ? '拖动鼠标框选关键主体或一条斜边。'
          : '在照片上点击任意关键主体，可单独检验局部解像力。'}
      </p>
      {exposureOverlay && (
        <p className="workspace-hint">
          红色：通道接近上限（高光过曝风险） · 蓝色：暗部极低像素（阴影欠曝风险）
        </p>
      )}
      <div
        className="preview-frame"
        style={{
          width:
            'min(100%, ' +
            (68 * image.naturalWidth) / image.naturalHeight +
            'vh)',
        }}
      >
        <canvas
          aria-label="照片选区工作台"
          style={{ touchAction: selecting ? 'none' : 'pan-y' }}
          ref={canvas}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            start.current = point(e);
            if (selecting) e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current && selecting) setDraft(selection(point(e)));
          }}
          onPointerUp={finish}
          onPointerCancel={() => {
            start.current = null;
            setDraft(roi);
          }}
        />
        <svg
          viewBox={'0 0 ' + image.naturalWidth + ' ' + image.naturalHeight}
          aria-hidden="true"
        >
          <rect
            x={draft.x}
            y={draft.y}
            width={draft.w}
            height={draft.h}
            fill="rgba(56,189,248,0.1)"
            stroke="#38bdf8"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <details className="roi-details">
        <summary>精确选区坐标</summary>
        <form
          className="roi-controls"
          onSubmit={(e) => {
            e.preventDefault();
            onRoiChange(
              clampRoi(draft, image.naturalWidth, image.naturalHeight),
            );
          }}
        >
          {(['x', 'y', 'w', 'h'] as const).map((key) => (
            <label key={key}>
              {{ x: 'X', y: 'Y', w: '宽', h: '高' }[key]}
              <input
                type="number"
                min={key === 'w' || key === 'h' ? 1 : 0}
                max={
                  key === 'x' || key === 'w'
                    ? image.naturalWidth
                    : image.naturalHeight
                }
                value={draft[key]}
                required
                onChange={(e) =>
                  setDraft({ ...draft, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button type="submit">应用选区</button>
        </form>
      </details>
      {showCrop && (
        <div className="crop-panel">
          <p>100% · 1 图像像素 = 1 CSS 像素 · 当前分析区域（最多 512×512）</p>
          <div className="crop-scroll">
            <canvas ref={crop} />
          </div>
        </div>
      )}
      {edges.length > 0 && (
        <details className="edge-list">
          <summary>已测斜边位置 · {edges.length}</summary>
          {edges.map((e) => (
            <button key={e.id} onClick={() => onSelectEdge(e)}>
              {e.zoneName} · {e.angleDeg.toFixed(1)}°
            </button>
          ))}
        </details>
      )}
    </section>
  );
}
