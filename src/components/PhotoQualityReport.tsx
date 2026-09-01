import React from 'react';
import { PhotoQualityReport as PhotoQualityReportType } from '../types/evaluation';
import {
  Sparkles,
  Eye,
  Sliders,
  Sun,
  Palette,
  Cpu,
  Layers,
  Info,
} from 'lucide-react';

interface PhotoQualityReportProps {
  report: PhotoQualityReportType | null;
}

export const PhotoQualityReport: React.FC<PhotoQualityReportProps> = ({
  report,
}) => {
  if (!report) {
    return (
      <div
        className="card-glass"
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Sparkles size={28} color="var(--accent-color)" />
        <span>正在生成照片技术质量报告...</span>
      </div>
    );
  }

  const {
    overallTechnicalSummary,
    subjectSharpness,
    flatNoise,
    exposureTone,
    colorPerformance,
    processingArtifacts,
    observedPhenomena,
    resolutionMegapixels,
    imageDimensions,
  } = report;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 顶部技术质量摘要横幅 */}
      <div
        className="card-glass"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.05) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', color: '#fff' }}>
            <Sparkles size={18} color="var(--accent-color)" />
            照片技术质量评价 (本次成片呈现)
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
            }}
          >
            {imageDimensions.width} × {imageDimensions.height} ({resolutionMegapixels} MP)
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6 }}>
          {overallTechnicalSummary}
        </p>
      </div>

      {/* 六大核心维度网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
        {/* 1. 主体清晰度与细节 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Eye size={16} color="var(--accent-color)" />
              主体清晰度与细节表现
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--accent-color)',
                fontWeight: 600,
              }}
            >
              {subjectSharpness.detailLevel}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>主体区域清晰度分</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                {subjectSharpness.subjectScore}
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>/ 100</span>
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>合焦景深覆盖</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>
                {subjectSharpness.inFocusRatioPct}%
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                  (虚化 {subjectSharpness.outOfFocusRatioPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* 景深免责与提示 */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="var(--accent-color)" />
            <span>{subjectSharpness.note} 可在右侧图像上拖拽框选主体以更新局部清晰度。</span>
          </div>
        </div>

        {/* 2. 平坦区真实底噪与信噪比 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Sliders size={16} color="#fbbf24" />
              平坦区真实底噪与 SNR
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                color: '#fbbf24',
                fontWeight: 600,
              }}
            >
              {flatNoise.noiseGrade}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>亮度噪声 σY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {flatNoise.luminanceNoiseSigma}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>色度噪声 σC</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {flatNoise.chromaNoiseSigma}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>实测信噪比</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
                {flatNoise.snrDb} <span style={{ fontSize: '10px' }}>dB</span>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              fontSize: '12px',
              color: '#fde68a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="#fbbf24" />
            <span>{flatNoise.note}</span>
          </div>
        </div>

        {/* 3. 曝光、动态范围与色阶截断 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Sun size={16} color="#f97316" />
              曝光、动态范围与层次
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#fb923c',
                fontWeight: 600,
              }}
            >
              {exposureTone.midtoneContrast}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>高光溢出截断 (Lum &gt; 254)</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: exposureTone.highlightClippingPct > 5 ? '#f87171' : '#4ade80',
                  marginTop: '4px',
                }}
              >
                {exposureTone.highlightClippingPct}%
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>暗部死黑截断 (Lum &lt; 2)</div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: exposureTone.shadowClippingPct > 10 ? '#fbbf24' : '#4ade80',
                  marginTop: '4px',
                }}
              >
                {exposureTone.shadowClippingPct}%
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="#f97316" />
            <span>{exposureTone.dynamicRangeNote}</span>
          </div>
        </div>

        {/* 4. 色彩表现与阶调连续性 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Palette size={16} color="#ec4899" />
              色彩表现与阶调连续性
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: colorPerformance.hasChannelOverflow
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
                color: colorPerformance.hasChannelOverflow ? '#fbbf24' : '#4ade80',
                fontWeight: 600,
              }}
            >
              {colorPerformance.hasChannelOverflow ? '部分通道溢出' : '阶调过渡连续'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>单色通道饱和状态</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {colorPerformance.hasChannelOverflow ? '存在高饱和溢出' : '无显著通道过载'}
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>色阶连续度评分</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ec4899', marginTop: '4px' }}>
                {colorPerformance.posterizationScore} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              fontSize: '12px',
              color: '#fbcfe8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="#ec4899" />
            <span>{colorPerformance.wbEvaluation.wbDeviationDescription}</span>
          </div>
        </div>

        {/* 4. 处理痕迹与压缩伪影 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Cpu size={16} color="#a855f7" />
              机内处理与压缩痕迹
            </div>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: processingArtifacts.hasSharpeningHalos
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(34, 197, 94, 0.15)',
                color: processingArtifacts.hasSharpeningHalos ? '#f87171' : '#4ade80',
                fontWeight: 600,
              }}
            >
              {processingArtifacts.hasSharpeningHalos ? '检测到锐化光晕' : '处理痕迹自然'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>边缘白边过冲率 (Overshoot)</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {processingArtifacts.overshootPct}%
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPEG 8×8 块效应马赛克</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                {processingArtifacts.jpegBlockinessPct}%
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              fontSize: '12px',
              color: '#e9d5ff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="#a855f7" />
            <span>{processingArtifacts.processingSummary}</span>
          </div>
        </div>

        {/* 5. 局部观察成像现象 (客观事实) */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Layers size={16} color="#06b6d4" />
              局部观察成像现象 (描述事实)
            </div>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#22d3ee',
              }}
            >
              未归因事实记录
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>观察到的边缘彩边跨度</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                {observedPhenomena.observedFringingWidthPx} px
              </div>
            </div>
            <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>观察到的四角变暗</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                {observedPhenomena.observedCornerDarkeningEv} EV
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={14} color="#06b6d4" />
            <span>{observedPhenomena.disclaimer}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
