
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { ROI, DetectedEdge } from '../types/mtf';
import { clampRoi } from '../core/pixels';
export function ImageWorkspace({ image, roi, onRoiChange, onDropFile, edges, onSelectEdge, sampleRoi }: {
  image: HTMLImageElement; roi: ROI; onRoiChange: (r: ROI) => void; onDropFile: (f: File) => void;
  edges: DetectedEdge[]; onSelectEdge: (e: DetectedEdge) => void; sampleRoi?: ROI;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), crop = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState(roi), [showCrop, setShowCrop] = useState(false);
  useEffect(() => { setDraft(roi); }, [roi]);
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    c.width = Math.max(1, Math.round(image.naturalWidth * scale)); c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(image, 0, 0, c.width, c.height);
  }, [image]);
  useEffect(() => {
    const c = crop.current; if (!c || !showCrop) return;
    const r = sampleRoi ?? roi; c.width = Math.min(512, r.w); c.height = Math.min(512, r.h);
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(image, r.x, r.y, c.width, c.height, 0, 0, c.width, c.height);
  }, [image, roi, showCrop, sampleRoi]);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(image.naturalWidth - 1, (e.clientX - b.left) / b.width * image.naturalWidth))), y: Math.round(Math.max(0, Math.min(image.naturalHeight - 1, (e.clientY - b.top) / b.height * image.naturalHeight))) };
  };
  const selection = (p: { x: number; y: number }): ROI => ({ x: Math.min(start.current!.x, p.x), y: Math.min(start.current!.y, p.y), w: Math.max(1, Math.abs(p.x - start.current!.x)), h: Math.max(1, Math.abs(p.y - start.current!.y)) });
  const finish = (e: PointerEvent<HTMLCanvasElement>) => { if (!start.current) return; const r = selection(point(e)); start.current = null; e.currentTarget.releasePointerCapture(e.pointerId); if (r.w >= 8 && r.h >= 8) onRoiChange(r); else setDraft(roi); };
  return <section className="workspace" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onDropFile(f); }}>
    <div className="workspace-toolbar"><span>{image.naturalWidth} × {image.naturalHeight} px</span><button onClick={() => setShowCrop(v => !v)} aria-pressed={showCrop}>{showCrop ? '收起' : '查看'} 100% 原像素</button></div>
    <p className="workspace-hint">在图上拖动框选主体或单条斜边，也可输入选区坐标。照片仅在浏览器中处理。</p>
    <div className="preview-frame"><canvas aria-label="照片选区工作台" ref={canvas} onPointerDown={e => { if (e.button !== 0) return; start.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (start.current) setDraft(selection(point(e))); }} onPointerUp={finish} onPointerCancel={() => { start.current = null; setDraft(roi); }} />
      <svg viewBox={'0 0 ' + image.naturalWidth + ' ' + image.naturalHeight} aria-hidden="true"><rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} fill="rgba(56,189,248,0.1)" stroke="#38bdf8" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
    </div>
    <form className="roi-controls" onSubmit={e => { e.preventDefault(); onRoiChange(clampRoi(draft, image.naturalWidth, image.naturalHeight)); }}>{(['x', 'y', 'w', 'h'] as const).map(key => <label key={key}>{({ x: 'X', y: 'Y', w: '宽', h: '高' })[key]}<input type="number" min={key === 'w' || key === 'h' ? 1 : 0} max={key === 'x' || key === 'w' ? image.naturalWidth : image.naturalHeight} value={draft[key]} required onChange={e => setDraft({ ...draft, [key]: Number(e.target.value) })} /></label>)}<button type="submit">应用选区</button></form>
    {showCrop && <div className="crop-panel"><p>100% · 1 图像像素 = 1 CSS 像素 · 当前分析区域（最多 512×512）</p><div className="crop-scroll"><canvas ref={crop} /></div></div>}
    <div className="edge-list"><b>候选斜边</b><p className="muted">{edges.length ? '点击候选位置，查看实际测量。候选位置不保证是镜头测试标板。' : '未找到合适候选。可手动框选 2°–15° 斜边；没有斜边不代表照片差。'}</p>{edges.map(e => <button key={e.id} onClick={() => onSelectEdge(e)}>{e.zoneName} · {e.angleDeg.toFixed(1)}°</button>)}</div>
  </section>;
}
