import React, { useState, useEffect, useCallback } from 'react';
import {
  ROI,
  MTFResult,
  LensQualityResult,
  DetectedEdge,
  AnalysisMode,
} from './types/mtf';
import {
  analyzeMtf,
  analyzeLensQuality,
  detectSlantedEdges,
} from './core';
import { SAMPLE_PRESETS, SamplePreset } from './core/sampleImages';
import { Header } from './components/Header';
import { ImageWorkspace } from './components/ImageWorkspace';
import { LensOverviewPanel } from './components/LensOverviewPanel';
import { MetricsCards } from './components/MetricsCards';
import { MtfChart } from './components/Charts/MtfChart';
import { EsfLsfChart } from './components/Charts/EsfLsfChart';
import { GuideModal } from './components/GuideSection';
import { Info, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('ISO 12233 标板样张');
  const [isSynthetic, setIsSynthetic] = useState<boolean>(true);
  const [mode, setMode] = useState<AnalysisMode>('overview');

  // ROI 选区
  const [roi, setRoi] = useState<ROI>({ x: 500, y: 320, w: 200, h: 160 });

  // 分析结果
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

  // 全面分析图像 (镜头素质 + 自动斜边扫描 + 当前 ROI MTF)
  const processImageAnalysis = useCallback((img: HTMLImageElement, currentRoi: ROI) => {
    // 1. 全图镜头光学成像质量评估
    try {
      const lq = analyzeLensQuality(img);
      setLensResult(lq);
    } catch (err) {
      console.error('Failed to analyze lens quality:', err);
    }

    // 2. 自动检测斜边
    try {
      const edges = detectSlantedEdges(img);
      setDetectedEdges(edges);
    } catch (err) {
      console.error('Failed to detect edges:', err);
    }

    // 3. 当前 ROI 斜边测量
    try {
      const res = analyzeMtf(img, currentRoi);
      setMtfResult(res);
    } catch (err) {
      console.error('Failed to analyze MTF on ROI:', err);
    }
  }, []);

  // 加载初始预设样张
  const loadPreset = useCallback(async (preset: SamplePreset) => {
    try {
      const img = await preset.generator();
      setImage(img);
      setFileName(preset.name);
      setIsSynthetic(true);

      const rw = Math.min(220, Math.floor((img.naturalWidth || 800) * 0.3));
      const rh = Math.min(220, Math.floor((img.naturalHeight || 600) * 0.3));
      const defaultRoi: ROI = {
        x: Math.floor(((img.naturalWidth || 800) - rw) / 2),
        y: Math.floor(((img.naturalHeight || 600) - rh) / 2),
        w: rw,
        h: rh,
      };
      setRoi(defaultRoi);
      processImageAnalysis(img, defaultRoi);
    } catch (err) {
      console.error('Failed to load sample preset:', err);
    }
  }, [processImageAnalysis]);

  // 初始化加载默认样张 (ISO 12233 标板样张)
  useEffect(() => {
    loadPreset(SAMPLE_PRESETS[0]);
  }, [loadPreset]);

  // 处理本地图片上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setFileName(file.name);
        setIsSynthetic(false);

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
        processImageAnalysis(img, defaultRoi);
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
      const res = analyzeMtf(image, newRoi);
      setMtfResult(res);
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      {/* 顶部导航 */}
      <Header
        mode={mode}
        onModeChange={setMode}
        onFileUpload={handleFileUpload}
        onSelectSample={loadPreset}
        onToggleGuide={() => setIsGuideOpen(true)}
        fileName={fileName}
        isSynthetic={isSynthetic}
      />

      {/* 主工作区 */}
      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(440px, 480px)',
          gap: '20px',
          padding: '20px 24px',
          flex: 1,
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

        {/* 右侧面板 */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'overview' ? (
            /* 模式 1: 全图镜头光学质量评估面板 */
            <LensOverviewPanel
              lensResult={lensResult}
              detectedEdges={detectedEdges}
              activeZoneId={activeZoneId}
              onHoverZone={setActiveZoneId}
              onSelectEdge={handleSelectEdge}
              onSwitchToEdgeMode={() => setMode('slanted_edge')}
            />
          ) : (
            /* 模式 2: 专业斜边 MTF / SFR 测量面板 */
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
                  onClick={() => setMode('overview')}
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
                  返回镜头综合质量总览
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
    </div>
  );
};
