
import { useEffect, useRef, useState } from 'react';
import type { AnalysisMode, DetectedEdge, ROI } from './types/mtf';
import type { AnalysisResult, MeasurementRecord, SourceKind } from './types/evaluation';
import { SOURCE_LABELS } from './types/evaluation';
import type { ParsedExifResult } from './types/exif';
import { decodeRawImage, isRawFile } from './core/rawDecoder';
import { parsePhotoExif } from './core/exifReader';
import { evaluateLensPerformance } from './core/lensPerformance';
import { downloadText } from './core/comparison';
import { SAMPLE_PRESETS } from './core/sampleImages';
import type { SamplePreset } from './core/sampleImages';
import { Header } from './components/Header';
import { ImageWorkspace } from './components/ImageWorkspace';
import { PhotoQualityReport } from './components/PhotoQualityReport';
import { LensPerformanceReport } from './components/LensPerformanceReport';
import { ComparisonPanel } from './components/ComparisonPanel';
import { MetricsCards } from './components/MetricsCards';
import { MtfChart } from './components/Charts/MtfChart';
import { EsfLsfChart } from './components/Charts/EsfLsfChart';
import { GuideModal } from './components/GuideSection';
import { ExifViewerModal } from './components/ExifViewerModal';
const RECORDS_KEY = 'lensmark.measurements.v2';
function readRecords(): MeasurementRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(value) ? value.filter(r => r && typeof r.id === 'string' && typeof r.fileName === 'string' && r.roi && Number.isFinite(r.width) && Number.isFinite(r.height) && (r.mtf50 === null || Number.isFinite(r.mtf50))).slice(0, 50) : [];
  } catch { return []; }
}
async function fileImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try { const image = new Image(); image.src = url; await image.decode(); return image; }
  catch { throw new Error('浏览器无法解码此图片。请使用 JPEG、PNG、WebP，或支持的相机 RAW；HEIC/TIFF 请先转换。'); }
  finally { URL.revokeObjectURL(url); }
}
export function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null), [fileName, setFileName] = useState('');
  const [source, setSource] = useState<SourceKind>('rendered'), [sourceNote, setSourceNote] = useState('');
  const [exif, setExif] = useState<ParsedExifResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('photo_quality');
  const [roi, setRoi] = useState<ROI>({ x: 0, y: 0, w: 200, h: 200 });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [guide, setGuide] = useState(false), [exifOpen, setExifOpen] = useState(false);
  const [records, setRecords] = useState<MeasurementRecord[]>(readRecords);
  const worker = useRef<Worker | null>(null), job = useRef(0), load = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => () => { load.current++; job.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch { setError('浏览器无法保存记录；请导出 CSV，避免刷新后丢失。'); } }, [records]);
  function stopWorker() { worker.current?.terminate(); worker.current = null; if (timer.current) clearTimeout(timer.current); }
  function cancel() { load.current++; job.current++; stopWorker(); setBusy(false); setStatus('已取消，可重新导入或重试分析。'); }
  function beginLoad() {
    const token = ++load.current; job.current++; stopWorker(); setImage(null); setResult(null); setExif(null);
    setSourceNote(''); setError(''); setBusy(true); setSaved(false); setStatus('正在读取图片…'); return token;
  }
  async function analyze(img: HTMLImageElement, area: ROI, fresh: boolean) {
    const id = ++job.current;
    setBusy(true); setResult(null); setSaved(false); setStatus('正在分析原像素与候选斜边…'); setError('');
    try {
      const bitmap = fresh || !worker.current ? await createImageBitmap(img) : undefined;
      if (id !== job.current) { bitmap?.close(); return; }
      if (!worker.current) {
        worker.current = new Worker(new URL('./core/analysis.worker.ts', import.meta.url), { type: 'module' });
        worker.current.onmessage = (event: MessageEvent<{ id: number; result?: AnalysisResult; error?: string }>) => {
          if (event.data.id !== job.current) return;
          if (timer.current) clearTimeout(timer.current);
          setBusy(false); setStatus('分析完成');
          if (event.data.error) { setError(event.data.error); setResult(null); }
          else setResult(event.data.result ?? null);
        };
        worker.current.onerror = () => { stopWorker(); setBusy(false); setResult(null); setError('后台分析无法运行，请使用支持 Worker 与 OffscreenCanvas 的现代浏览器后重试。'); };
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (job.current === id) { job.current++; stopWorker(); setBusy(false); setError('分析超时。请缩小选区或换用较小的原图后重试。'); } }, 45000);
      worker.current.postMessage({ id, roi: area, image: bitmap }, bitmap ? [bitmap] : []);
    } catch (e) { if (id === job.current) { stopWorker(); setBusy(false); setError(e instanceof Error ? e.message : '分析失败'); } }
  }
  async function acceptImage(img: HTMLImageElement, name: string, kind: SourceKind, parsed: ParsedExifResult | null, note: string, token: number) {
    if (token !== load.current) return;
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('图片尺寸无效');
    if (img.naturalWidth * img.naturalHeight > 100_000_000) throw new Error('图片超过 1 亿像素，请先导出较小版本；报告将只描述导入版本。');
    const w = Math.min(220, img.naturalWidth), h = Math.min(220, img.naturalHeight);
    const area = { x: Math.floor((img.naturalWidth - w) / 2), y: Math.floor((img.naturalHeight - h) / 2), w, h };
    setImage(img); setFileName(name); setSource(kind); setSourceNote(note); setExif(parsed); setRoi(area);
    await analyze(img, area, true);
  }
  async function upload(file: File) {
    const token = beginLoad(); setFileName(file.name);
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error('文件超过 200 MB，请导出较小版本后重试。');
      if (isRawFile(file)) {
        const raw = await decodeRawImage(file, msg => { if (token === load.current) setStatus(msg); });
        await acceptImage(raw.image, file.name, raw.sourceKind, raw.exifResult, raw.decoderInfo, token);
      } else {
        const [img, parsed] = await Promise.all([fileImage(file), parsePhotoExif(file).catch(() => null)]);
        await acceptImage(img, file.name, 'rendered', parsed, '', token);
      }
    } catch (e) { if (token === load.current) { setError(e instanceof Error ? e.message : '读取失败'); setBusy(false); setStatus('读取失败'); } }
  }
  async function preset(p: SamplePreset) {
    const token = beginLoad();
    try { await acceptImage(await p.generator(), p.name, 'synthetic', null, '数值来自实际演示像素，不提供预设镜头成绩。', token); }
    catch (e) { if (token === load.current) { setBusy(false); setError(e instanceof Error ? e.message : '演示加载失败'); } }
  }
  function changeRoi(r: ROI) { setRoi(r); if (image) void analyze(image, r, false); }
  function selectEdge(e: DetectedEdge) { setMode('slanted_edge'); changeRoi(e.roi); }
  function saveMeasurement() {
    if (!image || !result?.mtf.isValid || result.mtf.mtf50 === null || source === 'raw_preview' || source === 'synthetic') return;
    const m = exif?.overview;
    const record: MeasurementRecord = {
      id: crypto.randomUUID(), fileName, source, camera: m?.model || '', lens: m?.lensModel || '',
      aperture: m?.fNumber ?? null, focalLength: m?.focalLength ?? null, iso: m?.iso ?? null,
      width: image.naturalWidth, height: image.naturalHeight, roi, mtf50: result.mtf.mtf50,
      angle: result.mtf.angleDeg, orientation: result.mtf.isVerticalEdge ? 'vertical' : 'horizontal', createdAt: new Date().toISOString()
    };
    setRecords(prev => [...prev, record].slice(-50)); setSaved(true);
  }
  const lensReport = evaluateLensPerformance(result?.mtf ?? null, source);
  return <div className="app-shell"><Header mode={mode} onModeChange={setMode} onFileUpload={upload} onSelectSample={preset} onToggleGuide={() => setGuide(true)} />
    {error && <div className="error-banner" role="alert">{error}{image && !busy && <button onClick={() => analyze(image, roi, true)}>重试分析</button>}</div>}
    {(busy || status) && <div className="status-bar" role="status" aria-live="polite"><span>{busy && <span className="spinner" />}{status}</span>{busy && <button onClick={cancel}>取消</button>}</div>}
    {image && <div className="file-bar"><div><b>{fileName}</b><span>{SOURCE_LABELS[source]}</span>{sourceNote && <small>{sourceNote}</small>}</div><div className="header-actions"><button onClick={() => setExifOpen(true)}>EXIF 参数</button><button disabled={!result || busy} onClick={() => downloadText('LensMark-report.json', JSON.stringify({ schemaVersion: 2, fileName, source, sourceNote, roi, photo: result?.photo, mtf: result?.mtf, lens: lensReport }, null, 2))}>导出报告</button></div></div>}
    {mode === 'overview' ? <main className="records-main"><ComparisonPanel records={records} onRemove={id => setRecords(r => r.filter(x => x.id !== id))} /></main> : image ? <main className="analysis-layout">
      <ImageWorkspace image={image} roi={roi} onRoiChange={changeRoi} onDropFile={upload} edges={result?.edges ?? []} onSelectEdge={selectEdge} sampleRoi={result?.photo.subject.roi} />
      <aside className="report-stack" aria-busy={busy}>{busy ? <section className="report-card"><h2>正在分析</h2><p>你可以继续调整选区，页面将显示最后一次选择的结果。</p></section> : result ? <>
        {mode === 'photo_quality' && <PhotoQualityReport report={result.photo} />}
        {mode === 'lens_performance' && <LensPerformanceReport report={lensReport} onSwitchToEdgeRoiMode={() => setMode('slanted_edge')} />}
        {mode === 'slanted_edge' && <><section className="report-card"><div className="eyebrow">局部空间频率响应</div><h2>框选一条斜边</h2><p>建议约 5°，两侧平坦且不过曝，选区至少 48×48 原像素。依次测量中心与四角，分别保存。</p></section><MetricsCards result={result.mtf} /><div className="report-card"><MtfChart result={result.mtf} /></div><details className="report-card"><summary>查看 ESF / LSF 曲线</summary><EsfLsfChart result={result.mtf} /></details><section className="report-card"><button className="primary" disabled={!result.mtf.isValid || result.mtf.mtf50 === null || saved || source === 'synthetic' || source === 'raw_preview'} onClick={saveMeasurement}>{saved ? '已保存到测量记录' : '保存本次测量'}</button><p className="muted">合成图与 RAW 内嵌预览不加入实拍记录。最多保留 50 条；缺少 EXIF 的记录可导出，但不自动计算差值。</p></section></>}
      </> : <section className="report-card"><p>分析尚未完成。可重试或导入另一张图片。</p><button onClick={() => analyze(image, roi, true)}>开始分析</button></section>}</aside>
    </main> : <main className="welcome" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void upload(f); }}><div className="eyebrow">看清成片 · 积累证据</div><h2>一张照片，先回答能测的问题。</h2><p>导入原图，检查曝光和局部细节；想比较镜头，再用相同条件拍摄的斜边样张测量。照片不会上传。</p><div className="welcome-grid"><article><b>01 · 照片检查</b><p>曝光分布、平坦区噪声、原像素细节。</p></article><article><b>02 · 镜头测量</b><p>局部系统 MTF、有效性筛查与拍摄指南。</p></article><article><b>03 · 同条件记录</b><p>独立记录不同镜头与光圈，导出对比。</p></article></div><div className="drop-hint">把照片拖到这里，或点击顶部“导入照片”</div><button onClick={() => preset(SAMPLE_PRESETS[SAMPLE_PRESETS.length - 1])}>先试试合成斜边 →</button><p className="muted">支持 JPEG / PNG / WebP 与常见相机 RAW。RAW 支持情况取决于解码器；使用内嵌预览时会明确提示。</p></main>}
    <GuideModal isOpen={guide} onClose={() => setGuide(false)} /><ExifViewerModal isOpen={exifOpen} onClose={() => setExifOpen(false)} exifResult={exif} fileName={fileName} />
  </div>;
}
