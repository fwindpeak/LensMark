import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ROI,
  MTFResult,
  LensQualityResult,
  DetectedEdge,
  AnalysisMode,
} from './types/mtf';
import { ParsedExifResult } from './types/exif';
import {
  analyzeMtf,
  analyzeLensQuality,
  detectSlantedEdges,
  parsePhotoExif,
  isRawFile,
  decodeRawImage,
  evaluatePhotoQuality,
  evaluateLensPerformance,
} from './core';
import { PhotoQualityReport as PhotoQualityReportType, LensPerformanceReport as LensPerformanceReportType } from './types/evaluation';
import { SAMPLE_PRESETS, SamplePreset } from './core/sampleImages';
import { Header } from './components/Header';
import { ImageWorkspace } from './components/ImageWorkspace';
import { LensOverviewPanel } from './components/LensOverviewPanel';
import { PhotoQualityReport } from './components/PhotoQualityReport';
import { LensPerformanceReport } from './components/LensPerformanceReport';
import { MetricsCards } from './components/MetricsCards';
import { MtfChart } from './components/Charts/MtfChart';
import { EsfLsfChart } from './components/Charts/EsfLsfChart';
import { GuideModal } from './components/GuideSection';
import { ExifViewerModal } from './components/ExifViewerModal';
import { Info, ArrowLeft, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('ISO 12233 标板样张');
  const [isSynthetic, setIsSynthetic] = useState<boolean>(true);
  const isSyntheticRef = useRef<boolean>(true);
  const [mode, setMode] = useState<AnalysisMode>('photo_quality');

  // RAW 解码状态
  const [isDecodingRaw, setIsDecodingRaw] = useState<boolean>(false);
  const [rawDecodeStatus, setRawDecodeStatus] = useState<string>('');

  // EXIF 元数据状态
  const [exifResult, setExifResult] = useState<ParsedExifResult | null>(null);
  const [isExifModalOpen, setIsExifModalOpen] = useState<boolean>(false);

  // ROI 选区
  const [roi, setRoi] = useState<ROI>({ x: 500, y: 320, w: 200, h: 160 });

  // 双维度分析结果
  const [photoReport, setPhotoReport] = useState<PhotoQualityReportType | null>(null);
  const [lensReport, setLensReport] = useState<LensPerformanceReportType | null>(null);
  const [lensResult, setLensResult] = useState<LensQualityResult | null>(null);
  const [detectedEdges, setDetectedEdges] = useState<DetectedEdge[]>([]);
  const [mtfResult, setMtfResult] = useState<MTFResult | null>(null);

  // 视口与热力图控制
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.65);
  const [showEdgeBadges, setShowEdgeBadges] = useState<boolean>(true);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  // 弹窗说明
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // 全面分析图像 (照片技术质量 + 镜头光学归因 + 自动斜边扫描 + 当前 ROI MTF)
  const processImageAnalysis = useCallback(
    (img: HTMLImageElement, currentRoi: ROI, parsedExif?: ParsedExifResult | null, isSynth?: boolean) => {
      const synth = isSynth !== undefined ? isSynth : isSyntheticRef.current;
      let calculatedMtf: MTFResult | null = null;

      // 1. 当前 ROI 斜边测量
      try {
        calculatedMtf = analyzeMtf(img, currentRoi);
        setMtfResult(calculatedMtf);
      } catch (err) {
        console.error('Failed to analyze MTF on ROI:', err);
      }

      // 2. 照片技术质量评估 (Photo Technical Quality)
      let photoRes: PhotoQualityReportType | null = null;
      try {
        photoRes = evaluatePhotoQuality(
          img,
          currentRoi,
          img.naturalWidth,
          img.naturalHeight,
          parsedExif?.overview
        );
        setPhotoReport(photoRes);
      } catch (err) {
        console.error('Failed to evaluate photo quality:', err);
      }

      // 3. 镜头光学表现与归因检查 (Lens Optical Performance)
      if (photoRes) {
        try {
          const lensPerf = evaluateLensPerformance(
            img,
            photoRes,
            calculatedMtf,
            parsedExif,
            img.naturalWidth,
            img.naturalHeight,
            synth
          );
          setLensReport(lensPerf);
        } catch (err) {
          console.error('Failed to evaluate lens performance:', err);
        }
      }

      // 4. 全图镜头光学成像质量热力图与 9 像场
      try {
        const lq = analyzeLensQuality(
          img,
          img.naturalWidth,
          img.naturalHeight,
          parsedExif?.overview
        );
        setLensResult(lq);
      } catch (err) {
        console.error('Failed to analyze lens quality:', err);
      }

      // 5. 自动检测斜边
      try {
        const edges = detectSlantedEdges(img);
        setDetectedEdges(edges);
      } catch (err) {
        console.error('Failed to detect edges:', err);
      }
    },
    []
  );

  // 加载初始预设样张
  const loadPreset = useCallback(
    async (preset: SamplePreset) => {
      try {
        const img = await preset.generator();
        setImage(img);
        setFileName(preset.name);
        setIsSynthetic(true);
        isSyntheticRef.current = true;
        setExifResult(null);
        setActiveZoneId(null);

        const rw = Math.min(220, Math.floor((img.naturalWidth || 800) * 0.3));
        const rh = Math.min(220, Math.floor((img.naturalHeight || 600) * 0.3));
        const defaultRoi: ROI = {
          x: Math.floor(((img.naturalWidth || 800) - rw) / 2),
          y: Math.floor(((img.naturalHeight || 600) - rh) / 2),
          w: rw,
          h: rh,
        };
        setRoi(defaultRoi);
        processImageAnalysis(img, defaultRoi, null, true);
      } catch (err) {
        console.error('Failed to load sample preset:', err);
      }
    },
    [processImageAnalysis]
  );

  // 仅在首次挂载时加载默认样张 (ISO 12233 标板样张)
  useEffect(() => {
    loadPreset(SAMPLE_PRESETS[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理本地图片与 RAW 格式照片上传 (包括 LibRaw WebAssembly 解码与 EXIF 全量提取)
  const handleFileUpload = async (file: File) => {
    // 1. 判断是否为 RAW 格式照片
    if (isRawFile(file)) {
      try {
        setIsDecodingRaw(true);
        setRawDecodeStatus('正在初始化 LibRaw WebAssembly 解码器...');

        const result = await decodeRawImage(file, (msg) => {
          setRawDecodeStatus(msg);
        });

        const img = result.image;
        setImage(img);
        setFileName(`${file.name} [RAW]`);
        setIsSynthetic(false);
        isSyntheticRef.current = false;
        setExifResult(result.exifResult);
        setActiveZoneId(null);

        // 默认居中框选区域
        const rw = Math.min(240, Math.floor(img.naturalWidth * 0.35));
        const rh = Math.min(240, Math.floor(img.naturalHeight * 0.35));
        const defaultRoi: ROI = {
          x: Math.floor((img.naturalWidth - rw) / 2),
          y: Math.floor((img.naturalHeight - rh) / 2),
          w: rw,
          h: rh,
        };
        setRoi(defaultRoi);
        processImageAnalysis(img, defaultRoi, result.exifResult, false);
      } catch (err) {
        console.error('Failed to decode RAW file:', err);
        alert(`RAW 格式照片解码失败: ${err instanceof Error ? err.message : '未知错误'}`);
      } finally {
        setIsDecodingRaw(false);
        setRawDecodeStatus('');
      }
      return;
    }

    // 2. 常规 RGB 格式 (JPEG/PNG/WebP/TIFF) 处理
    let parsed: ParsedExifResult | null = null;
    try {
      parsed = await parsePhotoExif(file);
      setExifResult(parsed);
    } catch (err) {
      console.warn('Failed to parse EXIF from file:', err);
      setExifResult(null);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setFileName(file.name);
        setIsSynthetic(false);
        isSyntheticRef.current = false;
        setActiveZoneId(null);

        // 默认居中框选区域
        const rw = Math.min(240, Math.floor(img.naturalWidth * 0.35));
        const rh = Math.min(240, Math.floor(img.naturalHeight * 0.35));
        const defaultRoi: ROI = {
          x: Math.floor((img.naturalWidth - rw) / 2),
          y: Math.floor((img.naturalHeight - rh) / 2),
          w: rw,
          h: rh,
        };
        setRoi(defaultRoi);
        processImageAnalysis(img, defaultRoi, parsed, false);
      };
      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // ROI 选区发生变化 (用户手动拖拽或居中)
  const handleRoiChange = (newRoi: ROI) => {
    setRoi(newRoi);
    if (image) {
      // 重新计算 MTF
      let calculatedMtf: MTFResult | null = null;
      try {
        calculatedMtf = analyzeMtf(image, newRoi);
        setMtfResult(calculatedMtf);
      } catch (err) {
        console.error('Failed to update MTF on ROI change:', err);
      }

      // 重新评估主体区域清晰度
      try {
        const updatedPhoto = evaluatePhotoQuality(
          image,
          newRoi,
          image.naturalWidth,
          image.naturalHeight,
          exifResult?.overview
        );
        setPhotoReport(updatedPhoto);

        if (updatedPhoto) {
          const updatedLens = evaluateLensPerformance(
            image,
            updatedPhoto,
            calculatedMtf,
            exifResult,
            image.naturalWidth,
            image.naturalHeight,
            isSyntheticRef.current
          );
          setLensReport(updatedLens);
        }
      } catch (err) {
        console.error('Failed to update evaluations on ROI change:', err);
      }
    }
  };

  // 选中某个自动识别的斜边
  const handleSelectEdge = (edge: DetectedEdge) => {
    setRoi(edge.roi);
    setMode('slanted_edge');
    if (image) {
      const res = analyzeMtf(image, edge.roi);
      setMtfResult(res);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-color)',
      }}
    >
      {/* 顶部导航 */}
      <Header
        mode={mode}
        onModeChange={setMode}
        onFileUpload={handleFileUpload}
        onSelectSample={loadPreset}
        onToggleGuide={() => setIsGuideOpen(true)}
        onOpenExif={() => setIsExifModalOpen(true)}
        exifResult={exifResult}
        fileName={fileName}
        isSynthetic={isSynthetic}
      />

      {/* 主工作区 */}
      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(440px, 480px)',
          gap: '16px',
          padding: '16px 20px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          alignItems: 'stretch',
        }}
      >
        {/* 左侧视口 */}
        <ImageWorkspace
          image={image}
          roi={roi}
          mode={mode}
          heatmap={lensResult?.heatmap || null}
          showHeatmap={showHeatmap}
          heatmapOpacity={heatmapOpacity}
          detectedEdges={detectedEdges}
          showEdgeBadges={showEdgeBadges}
          activeZoneId={activeZoneId}
          zones={lensResult?.zones || []}
          onRoiChange={handleRoiChange}
          onDropFile={handleFileUpload}
          onToggleHeatmap={setShowHeatmap}
          onChangeHeatmapOpacity={setHeatmapOpacity}
          onToggleEdgeBadges={setShowEdgeBadges}
          onSelectDetectedEdge={handleSelectEdge}
        />

        {/* 右侧面板 (独立垂直滚动) */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '6px',
            paddingBottom: '16px',
          }}
        >
          {/* 模式 1: 照片技术质量报告 */}
          {mode === 'photo_quality' && (
            <PhotoQualityReport report={photoReport} />
          )}

          {/* 模式 2: 镜头光学表现报告 */}
          {mode === 'lens_performance' && (
            <LensPerformanceReport
              report={lensReport}
              onSwitchToEdgeRoiMode={() => setMode('slanted_edge')}
            />
          )}

          {/* 模式 3: 全图镜头光学质量综合总览与 9 像场 */}
          {mode === 'overview' && (
            <LensOverviewPanel
              lensResult={lensResult}
              detectedEdges={detectedEdges}
              activeZoneId={activeZoneId}
              onHoverZone={setActiveZoneId}
              onSelectEdge={handleSelectEdge}
              onSwitchToEdgeMode={() => setMode('slanted_edge')}
              onOpenExif={() => setIsExifModalOpen(true)}
            />
          )}

          {/* 模式 4: 专业斜边 MTF / SFR 测量面板 */}
          {mode === 'slanted_edge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 返回总览顶部栏 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                }}
              >
                <button
                  onClick={() => setMode('photo_quality')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: 'var(--text-color)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                >
                  <ArrowLeft size={14} />
                  返回照片质量报告
                </button>

                {detectedEdges.length > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    已自动定位 {detectedEdges.length} 处斜边
                  </span>
                )}
              </div>

              {/* 快速定位其他候选斜边切换栏 */}
              {detectedEdges.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>
                    快速跳转:
                  </span>
                  {detectedEdges.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => handleSelectEdge(e)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        backgroundColor:
                          roi.x === e.roi.x && roi.y === e.roi.y
                            ? 'var(--accent-color)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color:
                          roi.x === e.roi.x && roi.y === e.roi.y ? '#0b1120' : 'var(--text-muted)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                      }}
                    >
                      {e.zoneName} ({e.mtf50})
                    </button>
                  ))}
                </div>
              )}

              {/* MTF50 与角度指标卡 */}
              <MetricsCards result={mtfResult} />

              {/* MTF 调制传递函数频域图表 */}
              <div className="card-glass" style={{ padding: '12px' }}>
                <MtfChart result={mtfResult} />
              </div>

              {/* ESF / LSF 空间域图表 */}
              <div className="card-glass" style={{ padding: '12px' }}>
                <EsfLsfChart result={mtfResult} />
              </div>

              {/* 测量提示与帮助快捷卡片 */}
              <div
                className="card-glass"
                style={{
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={14} color="var(--accent-color)" />
                    ISO 12233 斜边测量要点
                  </span>
                  <button
                    onClick={() => setIsGuideOpen(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-color)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: 0,
                    }}
                  >
                    查看完整算法规范
                  </button>
                </div>
                <div>
                  1. 选区需跨越一段 <strong>5°~10°</strong> 的平直黑白边界，两侧保留纯色过渡区。<br />
                  2. <strong>MTF50</strong> 为调制对比度降至 50% 时的空间频率（cycles/pixel），数值越高表示解析力与边缘锐度越好。
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* 原理说明弹窗 */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* EXIF 元数据查看与导出弹窗 */}
      <ExifViewerModal
        isOpen={isExifModalOpen}
        onClose={() => setIsExifModalOpen(false)}
        exifResult={exifResult}
        fileName={fileName}
      />

      {/* LibRaw WebAssembly RAW 照片解码加载遮罩 */}
      {isDecodingRaw && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 17, 32, 0.88)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            className="card-glass"
            style={{
              padding: '32px 36px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(56, 189, 248, 0.2) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-color)',
              }}
            >
              <Loader2 size={28} className="spin" style={{ animation: 'spin 1.2s linear infinite' }} />
            </div>

            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                LibRaw WebAssembly RAW 格式解码中
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                {rawDecodeStatus || '正在通过纯浏览器端 WebAssembly 多线程解算相机 RAW 传感器信号与光学色彩...'}
              </p>
            </div>

            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '60%',
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '2px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            </div>

            <span style={{ fontSize: '11px', color: '#64748b' }}>
              支持 Sony ARW / Canon CR2·CR3 / Nikon NEF / Adobe DNG / Fuji RAF 等
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
