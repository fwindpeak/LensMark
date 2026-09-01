import React from 'react';
import { LensQualityResult, ROI } from '../types/mtf';
import { ZoneMatrixView } from './ZoneMatrixView';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Lightbulb,
  Sun,
  Eye,
} from 'lucide-react';

interface LensQualityDashboardProps {
  result: LensQualityResult | null;
  onSelectZoneRoi?: (roi: ROI) => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
}

export const LensQualityDashboard: React.FC<LensQualityDashboardProps> = ({
  result,
  onSelectZoneRoi,
  showHeatmap,
  onToggleHeatmap,
}) => {
  if (!result) {
    return (
      <div className="card-glass" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        正在分析镜头光学画质...
      </div>
    );
  }

  const {
    overallScore,
    gradeLevel,
    gradeTitle,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    zones,
    chromaticAberration,
    vignetting,
    diagnosisSummary,
    recommendations,
  } = result;

  const getGradeBadgeColor = (level: string) => {
    switch (level) {
      case 'S':
        return { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.4)' };
      case 'A':
        return { bg: 'rgba(74, 222, 128, 0.2)', text: '#4ade80', border: 'rgba(74, 222, 128, 0.4)' };
      case 'B':
        return { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.4)' };
      case 'C':
        return { bg: 'rgba(249, 115, 22, 0.2)', text: '#f97316', border: 'rgba(249, 115, 22, 0.4)' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
    }
  };

  const badgeStyle = getGradeBadgeColor(gradeLevel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 综合评分总览卡片 */}
      <div
        className="card-glass"
        style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Sparkles size={15} color="var(--accent-color)" />
              镜头光学画质综合评分
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
              <span
                style={{
                  fontSize: '38px',
                  fontWeight: 900,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#ffffff',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {overallScore}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ 100 分</span>
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: badgeStyle.bg,
                  border: `1px solid ${badgeStyle.border}`,
                  color: badgeStyle.text,
                  fontSize: '12px',
                  fontWeight: 700,
                  marginLeft: '4px',
                }}
              >
                {gradeLevel} 级 · {gradeTitle}
              </div>
            </div>
          </div>

          {/* 热力图快捷开关 */}
          <button
            onClick={onToggleHeatmap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showHeatmap ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${showHeatmap ? 'var(--accent-color)' : 'var(--border-color)'}`,
              color: showHeatmap ? 'var(--accent-color)' : 'var(--text-muted)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            <Eye size={13} />
            {showHeatmap ? '隐藏清晰度热力图' : '叠加清晰度热力图'}
          </button>
        </div>

        {/* 核心指标对比横条 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>中心锐度</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-color)' }}>
                {centerSharpness}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>边角平均锐度</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#e2e8f0' }}>
                {cornerAvgSharpness}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>边角解析衰减率</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: edgeFalloffPct <= 20 ? 'var(--success-color)' : edgeFalloffPct <= 35 ? 'var(--warning-color)' : 'var(--danger-color)',
                }}
              >
                {edgeFalloffPct}%
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {edgeFalloffPct <= 20 ? '(微弱)' : edgeFalloffPct <= 35 ? '(适中)' : '(显著)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 九宫格像场矩阵 */}
      <div className="card-glass" style={{ padding: '14px 16px' }}>
        <ZoneMatrixView zones={zones} onSelectZone={onSelectZoneRoi} />
      </div>

      {/* 色散与暗角两列卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* 色散 / 紫边 */}
        <div className="card-glass" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={12} color="#a78bfa" />
              色散与紫边 (CA)
            </span>
            <span style={{ fontSize: '10px', color: '#c4b5fd', fontWeight: 600 }}>
              {chromaticAberration.grade.split(' ')[0]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: '#f8fafc' }}>
              {chromaticAberration.averageCaPx}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>px 错位</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            彩边占比: {chromaticAberration.fringeRatio}% · 最大: {chromaticAberration.maxCaPx}px
          </span>
        </div>

        {/* 暗角 / 照度 */}
        <div className="card-glass" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sun size={12} color="#fbbf24" />
              暗角与光照均匀度
            </span>
            <span style={{ fontSize: '10px', color: '#fde68a', fontWeight: 600 }}>
              {vignetting.grade}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: '#f8fafc' }}>
              {vignetting.relativeIlluminationPct}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>相对照度</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            边角衰减: {vignetting.evLoss} EV · 中心: {vignetting.centerLuminance}
          </span>
        </div>
      </div>

      {/* 智能光学诊断结论与使用建议 */}
      <div
        className="card-glass"
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          borderLeft: '4px solid var(--accent-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-color)' }}>
          <Lightbulb size={14} color="var(--accent-color)" />
          光学诊断结论与摄影建议
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          {diagnosisSummary}
        </p>

        {recommendations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
            {recommendations.map((rec, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                <CheckCircle2 size={12} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
