import React, { useState, useEffect, useCallback } from 'react';
import { ROI, MTFResult } from './types/mtf';
import { generateSyntheticSlantedEdge, analyzeMtf } from './core';
import { Header } from './components/Header';
import { ImageWorkspace } from './components/ImageWorkspace';
import { MetricsCards } from './components/MetricsCards';
import { MtfChart } from './components/Charts/MtfChart';
import { EsfLsfChart } from './components/Charts/EsfLsfChart';
import { GuideModal } from './components/GuideSection';
import { Info } from 'lucide-react';

export const App: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('模拟斜边 (5.7°)');
  const [isSynthetic, setIsSynthetic] = useState<boolean>(true);
  const [roi, setRoi] = useState<ROI>({ x: 100, y: 80, w: 200, h: 240 });
  const [result, setResult] = useState<MTFResult | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // 执行 MTF 分析
  const performAnalysis = useCallback((img: HTMLImageElement, currentRoi: ROI) => {
    const res = analyzeMtf(img, currentRoi);
    setResult(res);
  }, []);

  // 生成合成斜边
  const loadSyntheticEdge = useCallback(async () => {
    try {
      const img = await generateSyntheticSlantedEdge(400, 400, 5.7);
      setImage(img);
      setFileName('模拟斜边 (5.7°)');
      setIsSynthetic(true);
      const defaultRoi: ROI = { x: 100, y: 80, w: 200, h: 240 };
      setRoi(defaultRoi);
      performAnalysis(img, defaultRoi);
    } catch (err) {
      console.error('Failed to generate synthetic edge:', err);
    }
  }, [performAnalysis]);

  // 初始化加载合成斜边
  useEffect(() => {
    loadSyntheticEdge();
  }, [loadSyntheticEdge]);

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setFileName(file.name);
        setIsSynthetic(false);

        // 默认居中框选一个区域
        const rw = Math.min(240, Math.floor(img.naturalWidth * 0.4));
        const rh = Math.min(240, Math.floor(img.naturalHeight * 0.4));
        const defaultRoi: ROI = {
          x: Math.floor((img.naturalWidth - rw) / 2),
          y: Math.floor((img.naturalHeight - rh) / 2),
          w: rw,
          h: rh,
        };
        setRoi(defaultRoi);
        performAnalysis(img, defaultRoi);
      };
      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  // ROI 选区发生变化
  const handleRoiChange = (newRoi: ROI) => {
    setRoi(newRoi);
    if (image) {
      performAnalysis(image, newRoi);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      {/* 顶部导航 */}
      <Header
        onFileUpload={handleFileUpload}
        onGenerateSynthetic={loadSyntheticEdge}
        onToggleGuide={() => setIsGuideOpen(true)}
        fileName={fileName}
        isSynthetic={isSynthetic}
      />

      {/* 主工作区 */}
      <main
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 460px',
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
          onRoiChange={handleRoiChange}
          onDropFile={handleFileUpload}
        />

        {/* 右侧面板 */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 指标卡片 */}
          <MetricsCards result={result} />

          {/* MTF 调制传递函数图表 */}
          <div className="card-glass" style={{ padding: '12px' }}>
            <MtfChart result={result} />
          </div>

          {/* ESF / LSF 空间域图表 */}
          <div className="card-glass" style={{ padding: '12px' }}>
            <EsfLsfChart result={result} />
          </div>

          {/* 底部使用提示与说明快捷卡片 */}
          <div
            className="card-glass"
            style={{
              padding: '14px 16px',
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
                测量提示
              </span>
              <button
                onClick={() => setIsGuideOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                查看完整算法原理
              </button>
            </div>
            <div>
              1. 框选时确保 ROI 完整跨越一段 <strong>5°~10°</strong> 的倾斜黑白边缘，且边缘两端保留纯色缓冲。<br />
              2. <strong>MTF50</strong> 为对比度降至 50% 时的空间频率（cycles/pixel），数值越高解析力越强。
            </div>
          </div>
        </aside>
      </main>

      {/* 原理说明弹窗 */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};
