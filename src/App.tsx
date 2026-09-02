import { useEffect, useRef, useState } from 'react';
import { Upload, ImagePlus, ShieldCheck } from 'lucide-react';
import type { AnalysisMode, ROI } from './types/mtf';
import type { AnalysisResult, SourceKind } from './types/evaluation';
import { SOURCE_LABELS } from './types/evaluation';
import type { EvaluationRecord, TestScene } from './types/assessment';
import type { ParsedExifResult } from './types/exif';
import { decodeRawImage, isRawFile } from './core/rawDecoder';
import { parsePhotoExif } from './core/exifReader';
import { AnalysisClient } from './core/analysisClient';
import { downloadText } from './core/comparison';
import { demoImage, DEMOS } from './core/demoImages';
import type { DemoKind } from './core/demoImages';
import {
  makeRecord,
  parseRecords,
  migrateLegacyRecords,
  RECORDS_KEY,
} from './core/evaluationRecords';
import { abortable } from './core/cancellation';
import { Header } from './components/Header';
import { ImageWorkspace } from './components/ImageWorkspace';
import {
  PhotoQualityReport,
  PhotoSummary,
} from './components/PhotoQualityReport';
import { LensPerformanceReport } from './components/LensPerformanceReport';
import { ComparisonPanel } from './components/ComparisonPanel';
import { MetricsCards } from './components/MetricsCards';
import { MtfChart } from './components/Charts/MtfChart';
import { EsfLsfChart } from './components/Charts/EsfLsfChart';
import { GuideModal } from './components/GuideSection';
import { ExifViewerModal } from './components/ExifViewerModal';

interface LoadedPhoto {
  id: string;
  image: HTMLImageElement;
  name: string;
  source: SourceKind;
  exif: ParsedExifResult | null;
  note: string;
  thumbnail: string;
}
function readRecords() {
  try {
    const saved = localStorage.getItem(RECORDS_KEY);
    return saved === null
      ? migrateLegacyRecords(
          localStorage.getItem('lensmark.measurements.v2') ?? '[]',
        )
      : parseRecords(saved);
  } catch {
    return [];
  }
}
function thumbnail(image: HTMLImageElement) {
  const c = document.createElement('canvas'),
    ratio = Math.min(
      1,
      240 / Math.max(image.naturalWidth, image.naturalHeight),
    );
  c.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  c.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(image, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.65);
}
async function readImage(
  file: File,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    image.src = url;
    await abortable(image.decode(), signal);
    return image;
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error(
      '无法读取这张图片。请使用 JPEG、PNG、WebP 或支持的相机 RAW。',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('lensmark.theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });
  const [current, setCurrent] = useState<LoadedPhoto | null>(null);
  const currentRef = useRef<LoadedPhoto | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('photo_quality'),
    [scene, setScene] = useState<TestScene>('general');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [roi, setRoi] = useState<ROI>({ x: 0, y: 0, w: 200, h: 200 }),
    [subjectOnly, setSubjectOnly] = useState(false);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState('');
  const [guide, setGuide] = useState(false),
    [exifOpen, setExifOpen] = useState(false);
  const [records, setRecords] = useState<EvaluationRecord[]>(readRecords);
  const [removed, setRemoved] = useState<EvaluationRecord | null>(null);
  const input = useRef<HTMLInputElement>(null),
    client = useRef(new AnalysisClient()),
    version = useRef(0);
  const abort = useRef<AbortController | null>(null),
    uploading = useRef(false);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('lensmark.theme', theme);
    } catch {}
  }, [theme]);
  useEffect(
    () => () => {
      version.current++;
      abort.current?.abort();
      client.current.dispose();
    },
    [],
  );
  useEffect(() => {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch {
      setError(
        '浏览器保存空间不足，请在对比页导出记录备份；当前报告仍可查看。',
      );
    }
  }, [records]);

  function stop() {
    version.current++;
    abort.current?.abort();
    client.current.dispose();
    uploading.current = false;
  }
  function cancel() {
    stop();
    setBusy(false);
    setStatus('已取消。已完成的报告已保留，可继续上传或重试。');
  }
  function remember(
    photo: LoadedPhoto,
    analysis: AnalysisResult,
    testScene: TestScene,
  ) {
    const record = makeRecord(analysis, {
      id: photo.id,
      name: photo.name,
      source: photo.source,
      scene: testScene,
      exif: photo.exif,
      thumbnail: photo.thumbnail,
    });
    setRecords((previous) => {
      const old = previous.find((r) => r.id === photo.id);
      // Preserve user-supplied metadata when a scene is remeasured.
      const merged = old
        ? {
            ...record,
            camera: old.camera,
            lens: old.lens,
            aperture: old.aperture,
            focalLength: old.focalLength,
            iso: old.iso,
          }
        : record;
      return [merged, ...previous.filter((r) => r.id !== photo.id)].slice(
        0,
        50,
      );
    });
  }
  async function analyze(
    photo: LoadedPhoto,
    testScene: TestScene,
    area: ROI | null,
    onlySubject: boolean,
    token: number,
    prefix = '',
  ) {
    const analysis = await client.current.run(
      photo.image,
      area,
      testScene,
      onlySubject,
      (message) => {
        if (token === version.current) setStatus(prefix + message);
      },
    );
    if (token !== version.current) return;
    setResult(analysis);
    setRoi(analysis.selection);
    setSubjectOnly(onlySubject);
    // Subject spot-checks must not silently replace a full-photo comparison score.
    if (!onlySubject) remember(photo, analysis, testScene);
    return analysis;
  }
  async function rerun(
    testScene = scene,
    area: ROI | null = null,
    onlySubject = false,
  ) {
    const photo = currentRef.current;
    if (!photo || uploading.current) return;
    const token = ++version.current;
    setScene(testScene);
    setBusy(true);
    setResult(null);
    setError('');
    try {
      await analyze(photo, testScene, area, onlySubject, token);
      if (token === version.current) {
        setBusy(false);
        setStatus('分析完成 · 报告已保存');
      }
    } catch (e) {
      if (token === version.current) {
        setBusy(false);
        setError(e instanceof Error ? e.message : '分析失败');
      }
    }
  }
  async function accept(
    photo: LoadedPhoto,
    testScene: TestScene,
    token: number,
    prefix = '',
  ) {
    if (token !== version.current) return;
    const { naturalWidth: w, naturalHeight: h } = photo.image;
    if (!w || !h || w * h > 100_000_000)
      throw new Error('图片尺寸无效或超过 1 亿像素，请导出较小版本。');
    photo.thumbnail = thumbnail(photo.image);
    currentRef.current = photo;
    setCurrent(photo);
    setScene(testScene);
    setSubjectOnly(false);
    setResult(null);
    await analyze(photo, testScene, null, false, token, prefix);
  }
  async function upload(files: File[]) {
    if (!files.length) return;
    stop();
    const token = version.current,
      controller = new AbortController();
    abort.current = controller;
    uploading.current = true;
    setBusy(true);
    setError('');
    setResult(null);
    const selected = files.slice(0, 12),
      failures: string[] = [];
    let completed = 0;
    const testScene = mode === 'photo_quality' ? 'general' : scene;
    for (let i = 0; i < selected.length; i++) {
      if (token !== version.current) break;
      const file = selected[i],
        prefix =
          selected.length > 1 ? i + 1 + '/' + selected.length + ' · ' : '';
      setStatus(prefix + '正在读取 ' + file.name);
      const timeout = setTimeout(
        () => controller.abort(new Error('文件解码超时')),
        60000,
      );
      try {
        if (file.size > 200 * 1024 * 1024) throw new Error('文件超过 200 MB');
        let photo: LoadedPhoto;
        if (isRawFile(file)) {
          const raw = await decodeRawImage(
            file,
            (message) => {
              if (token === version.current) setStatus(prefix + message);
            },
            undefined,
            controller.signal,
          );
          photo = {
            id: crypto.randomUUID(),
            image: raw.image,
            name: file.name,
            source: raw.sourceKind,
            exif: raw.exifResult,
            note: raw.decoderInfo,
            thumbnail: '',
          };
        } else {
          const [image, exif] = await abortable(
            Promise.all([
              readImage(file, controller.signal),
              parsePhotoExif(file).catch(() => null),
            ]),
            controller.signal,
          );
          photo = {
            id: crypto.randomUUID(),
            image,
            name: file.name,
            source: 'rendered',
            exif,
            note: '',
            thumbnail: '',
          };
        }
        clearTimeout(timeout);
        await accept(photo, testScene, token, prefix);
        completed++;
      } catch (e) {
        if (token !== version.current) break;
        failures.push(
          file.name +
            '：' +
            (controller.signal.aborted
              ? '读取超时，请换较小文件重试'
              : e instanceof Error
                ? e.message
                : '无法读取'),
        );
        if (controller.signal.aborted) break;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (token === version.current) {
      uploading.current = false;
      setBusy(false);
      setStatus(
        '完成 ' +
          completed +
          ' 张' +
          (completed ? ' · 报告已保存到对比页' : '') +
          (files.length > 12 ? '；每批最多 12 张，剩余请继续上传' : ''),
      );
      setError(failures.join('；'));
    }
  }
  async function demo(kind: DemoKind) {
    const preset = DEMOS.find((d) => d.id === kind);
    if (!preset) return;
    stop();
    const token = version.current;
    setBusy(true);
    setError('');
    setStatus('正在生成合成演示…');
    setMode(preset.scene === 'general' ? 'photo_quality' : 'lens_performance');
    try {
      const image = await demoImage(kind);
      await accept(
        {
          id: crypto.randomUUID(),
          image,
          name: preset.name + '（合成演示）',
          source: 'synthetic',
          exif: null,
          note: '演示像素，不代表任何真实镜头；所有结果均由同一分析流程计算。',
          thumbnail: '',
        },
        preset.scene,
        token,
      );
      if (token === version.current) {
        setBusy(false);
        setStatus('合成演示已完成');
      }
    } catch (e) {
      if (token === version.current) {
        setBusy(false);
        setError(e instanceof Error ? e.message : '演示加载失败');
      }
    }
  }
  function select(roi: ROI) {
    void rerun(scene, roi, mode === 'photo_quality');
  }
  function inspectEdge(roi: ROI) {
    setMode('slanted_edge');
    void rerun(scene, roi, false);
  }
  function updateRecord(record: EvaluationRecord) {
    setRecords((r) => r.map((item) => (item.id === record.id ? record : item)));
  }
  function importRecords(incoming: EvaluationRecord[]) {
    setRecords((previous) =>
      [
        ...incoming,
        ...previous.filter((r) => !incoming.some((n) => n.id === r.id)),
      ].slice(0, 50),
    );
  }
  function exportReport() {
    if (!result || !current) return;
    downloadText(
      current.name.replace(/\.[^.]+$/, '') + '-LensMark.json',
      JSON.stringify(
        {
          version: 3,
          fileName: current.name,
          source: current.source,
          scene,
          subjectOnly,
          analysis: result,
        },
        null,
        2,
      ),
    );
  }
  return (
    <div className="app-shell" id="top">
      <Header
        mode={mode}
        onModeChange={setMode}
        onFiles={upload}
        onDemo={demo}
        onGuide={() => setGuide(true)}
        count={records.length}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
      {(busy || status) && (
        <div className="status-bar" role="status" aria-live="polite">
          <span>
            {busy && <span className="spinner" />}
            {status}
          </span>
          {busy && <button onClick={cancel}>取消</button>}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError('')}>关闭</button>
          {current && !busy && (
            <button onClick={() => rerun()}>重试当前照片</button>
          )}
        </div>
      )}
      {mode === 'overview' ? (
        <main className="records-main">
          {removed && (
            <div className="undo-bar">
              已删除 {removed.fileName}
              <button
                onClick={() => {
                  importRecords([removed]);
                  setRemoved(null);
                }}
              >
                撤销
              </button>
            </div>
          )}
          <ComparisonPanel
            records={records}
            onUpdate={updateRecord}
            onImport={importRecords}
            onRemove={(id) => {
              setRemoved(records.find((r) => r.id === id) ?? null);
              setRecords((r) => r.filter((item) => item.id !== id));
            }}
          />
        </main>
      ) : current ? (
        <main className="analysis-main" aria-busy={busy}>
          <div className="file-bar">
            <div>
              <b>{current.name}</b>
              <span>
                {SOURCE_LABELS[current.source]}
                {current.exif?.overview.model
                  ? ' · ' + current.exif.overview.model
                  : ''}
              </span>
            </div>
            <div className="button-row">
              <button onClick={() => setExifOpen(true)}>拍摄信息</button>
              <button disabled={!result || busy} onClick={exportReport}>
                导出报告
              </button>
              <button onClick={() => setMode('overview')}>查看对比</button>
            </div>
          </div>
          {current.source === 'synthetic' && (
            <div className="source-banner">合成演示 · {current.note}</div>
          )}
          {current.source === 'raw_preview' && (
            <div className="source-banner">
              正在分析 RAW 内嵌预览图（用于评估预览画质，不代表原 RAW 原像素评级）。
            </div>
          )}
          {result && mode === 'photo_quality' && (
            <PhotoSummary
              assessment={result.assessment}
              subjectOnly={subjectOnly}
            />
          )}
          {result && mode !== 'photo_quality' && (
            <section className="lens-heading">
              <div>
                <div className="eyebrow">镜头光学性能评测</div>
                <h2>
                  {scene === 'flat'
                    ? '暗角与相对照度衰减'
                    : scene === 'grid'
                      ? '几何线条与径向畸变率'
                      : '解像力 (MTF50) 与横向色散'}
                </h2>
                <p>
                  结合图像数据评估画质与光学特征。评估结果包含相机 Sensor、焦点精准度与算法处理的综合表现。
                </p>
              </div>
            </section>
          )}
          <div className="analysis-layout">
            <div className="visual-column">
              <ImageWorkspace
                image={current.image}
                roi={roi}
                onRoiChange={select}
                onDropFiles={upload}
                edges={result?.edges ?? []}
                onSelectEdge={(e) => inspectEdge(e.roi)}
                sampleRoi={result?.photo.subject.roi}
                onAuto={() => rerun(scene)}
                subjectOnly={subjectOnly}
              />
              {result && (
                <details
                  className="report-card curve-details"
                  open={mode === 'slanted_edge'}
                >
                  <summary>局部 MTF 曲线与专业数据</summary>
                  <MetricsCards result={result.mtf} />
                  {result.mtf.isValid && (
                    <>
                      <MtfChart result={result.mtf} />
                      <EsfLsfChart result={result.mtf} />
                    </>
                  )}
                  {!result.mtf.isValid && (
                    <p>
                      照片仍可评价。要测局部 MTF，请选择 2°–15°
                      的单一直斜边，或在镜头页使用测试靶。
                    </p>
                  )}
                </details>
              )}
            </div>
            <div className="report-stack">
              {result ? (
                mode === 'photo_quality' ? (
                  <PhotoQualityReport result={result} />
                ) : (
                  <LensPerformanceReport
                    result={result}
                    scene={scene}
                    onScene={(s) => rerun(s)}
                    onSelect={inspectEdge}
                    onDemo={demo}
                  />
                )
              ) : (
                <section className="report-card loading-panel">
                  <h2>{busy ? '正在分析照片' : '等待分析'}</h2>
                  <p>
                    {busy
                      ? '曝光、清晰度和镜头测量完成后会自动显示。'
                      : '点击重试继续检查这张照片。'}
                  </p>
                  {!busy && <button onClick={() => rerun()}>重试分析</button>}
                </section>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main
          className="welcome"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="upload-card">
            <ImagePlus size={38} />
            <h2>这张照片拍得怎么样？</h2>
            <p>上传即得清晰度、曝光、噪点结论；进一步测量和对比镜头表现。</p>
            <button
              className="primary large"
              onClick={() => input.current?.click()}
            >
              <Upload size={18} />
              选择照片
            </button>
            <span>或拖入这里 · 可批量选择最多 12 张</span>
            <input
              ref={input}
              type="file"
              hidden
              multiple
              accept="image/*,.arw,.cr2,.cr3,.nef,.dng,.raf,.orf,.rw2,.raw"
              onChange={(e) => {
                if (e.target.files) void upload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <small>
              <ShieldCheck size={14} />
              照片不上传服务器 · JPEG / PNG / WebP / 常见 RAW
            </small>
          </div>
          <section className="demo-strip">
            <h3>没有照片？先体验实际分析</h3>
            <div>
              {DEMOS.map((d) => (
                <button key={d.id} onClick={() => demo(d.id)}>
                  {d.name} →
                </button>
              ))}
            </div>
            <small>合成样张用于理解工具，结果不是预设成绩。</small>
          </section>
          <p className="welcome-footnote">
            照片评价辅助判断成片技术质量；镜头评价支持九区解析力、横向色差、平场暗角和网格畸变。缺少专用样张时，会给出下一步拍摄入口。
          </p>
        </main>
      )}
      <GuideModal isOpen={guide} onClose={() => setGuide(false)} />
      <ExifViewerModal
        isOpen={exifOpen}
        onClose={() => setExifOpen(false)}
        exifResult={current?.exif ?? null}
        fileName={current?.name}
      />
    </div>
  );
}
