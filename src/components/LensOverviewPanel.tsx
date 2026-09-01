import React from 'react';
import { LensQualityResult, ZoneMetric, DetectedEdge } from '../types/mtf';
import {
  Award,
  Sparkles,
  Zap,
  Layers,
  ChevronRight,
  Sun,
  Eye,
  AlertCircle,
  Lightbulb,
  Crosshair,
} from 'lucide-react';

interface LensOverviewPanelProps {
  lensResult: LensQualityResult | null;
  detectedEdges: DetectedEdge[];
  activeZoneId: string | null;
  onHoverZone: (zoneId: string | null) => void;
  onSelectEdge: (edge: DetectedEdge) => void;
  onSwitchToEdgeMode: () => void;
  onOpenExif?: () => void;
}

export const LensOverviewPanel: React.FC<LensOverviewPanelProps> = ({
  lensResult,
  detectedEdges,
  activeZoneId,
  onHoverZone,
  onSelectEdge,
  onSwitchToEdgeMode,
  onOpenExif,
}) => {
  if (!lensResult) {
    return (
      <div
        className="card-glass"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          color: 'var(--text-muted)',
          gap: '12px',
        }}
      >
        <Zap size={32} color="var(--accent-color)" />
        <span style={{ fontSize: '14px' }}>正在分析镜头全图成像质量...</span>
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
    overshootPct,
    isOversharpened,
    lwphEstimate,
    textureConfidence,
    zones,
    chromaticAberration,
    vignetting,
    diagnosisSummary,
    recommendations,
  } = lensResult;

  // 评级徽章颜色映射
  const gradeColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    S: {
      bg: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
      text: '#ffffff',
      border: '#7dd3fc',
      glow: 'rgba(56, 189, 248, 0.4)',
    },
    A: {
      bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      text: '#ffffff',
      border: '#6ee7b7',
      glow: 'rgba(16, 185, 129, 0.4)',
    },
    B: {
      bg: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
      text: '#ffffff',
      border: '#38bdf8',
      glow: 'rgba(14, 165, 233, 0.3)',
    },
    C: {
      bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      text: '#ffffff',
      border: '#fcd34d',
      glow: 'rgba(245, 158, 11, 0.3)',
    },
    D: {
      bg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      text: '#ffffff',
      border: '#fca5a5',
      glow: 'rgba(239, 68, 68, 0.3)',
    },
  };

  const currentGradeStyle = gradeColors[gradeLevel] || gradeColors.B;

  // 9 宫格映射定义
  const gridLayout: (ZoneMetric['id'] | null)[][] = [
    ['top_left', 'top', 'top_right'],
    ['left', 'center', 'right'],
    ['bottom_left', 'bottom', 'bottom_right'],
  ];

  const zoneMap = new Map<string, ZoneMetric>();
  zones.forEach((z) => zoneMap.set(z.id, z));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. 镜头综合评级卡片 */}
      <div
        className="card-glass"
        style={{
          padding: '18px 20px',
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 评级徽章 */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: currentGradeStyle.bg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 20px ${currentGradeStyle.glow}`,
              border: `1px solid ${currentGradeStyle.border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '24px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              {gradeLevel}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em' }}>
              GRADE
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                {gradeTitle}
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              综合中心锐度、边角一致性、色散抑制与暗角表现
            </p>
          </div>
        </div>

        {/* 综合得分数字 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span
              style={{
                fontSize: '36px',
                fontWeight: 900,
                fontFamily: 'ui-monospace, monospace',
                color: 'var(--accent-color)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {overallScore}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>镜头综合评分</span>
        </div>
      </div>

      {/* 1.5. 真实光学特性与计算摄影白边检测条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '10px',
          backgroundColor: isOversharpened
            ? 'rgba(245, 158, 11, 0.12)'
            : 'rgba(56, 189, 248, 0.1)',
          border: `1px solid ${
            isOversharpened ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.25)'
          }`,
          fontSize: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOversharpened ? (
            <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          ) : (
            <Sparkles size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
          )}
          <span style={{ color: isOversharpened ? '#fcd34d' : '#e2e8f0' }}>
            {isOversharpened
              ? `检测到机内计算摄影强锐化 (边缘过冲 +${overshootPct}%)，已校准去除非光学虚高`
              : `纯正光学阶跃响应 (边缘过冲 ${overshootPct}%)，无人工锐化白边`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>
            估计解析力: <strong style={{ color: '#fff' }}>{lwphEstimate} LW/PH</strong>
          </span>
          <span>
            纹理置信度: <strong style={{ color: '#38bdf8' }}>{textureConfidence}%</strong>
          </span>
          {onOpenExif && (
            <button
              onClick={onOpenExif}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                fontSize: '11px',
              }}
            >
              查看机身镜头 EXIF
            </button>
          )}
        </div>
      </div>

      {/* 2. 核心 4 维指标栅格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {/* 中心锐度 */}
        <div
          className="card-glass"
          style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Award size={14} color="#38bdf8" />
              中心像场锐度
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: centerSharpness >= 75 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                color: centerSharpness >= 75 ? 'var(--success-color)' : 'var(--warning-color)',
                fontWeight: 600,
              }}
            >
              {centerSharpness >= 85 ? '极高锐度' : centerSharpness >= 70 ? '良好' : '较软'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#f8fafc',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {centerSharpness}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分 (高频响应)</span>
          </div>
        </div>

        {/* 边角衰减率 */}
        <div
          className="card-glass"
          style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} color="#a855f7" />
              边角画质衰减
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: edgeFalloffPct <= 20 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                color: edgeFalloffPct <= 20 ? 'var(--success-color)' : 'var(--warning-color)',
                fontWeight: 600,
              }}
            >
              {edgeFalloffPct <= 20 ? '平坦均衡' : edgeFalloffPct <= 35 ? '常规软化' : '明显软化'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: edgeFalloffPct <= 25 ? '#4ade80' : edgeFalloffPct <= 40 ? '#fbbf24' : '#f87171',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {edgeFalloffPct}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (角均分 {cornerAvgSharpness})
            </span>
          </div>
        </div>

        {/* 色差与紫边 */}
        <div
          className="card-glass"
          style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#ec4899" />
              色散与紫边 (CA)
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                color: '#f472b6',
                fontWeight: 600,
              }}
            >
              {chromaticAberration.grade.split(' ')[0]}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#f8fafc',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {chromaticAberration.averageCaPx}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              px (错位宽度)
            </span>
          </div>
        </div>

        {/* 暗角与相对照度 */}
        <div
          className="card-glass"
          style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sun size={14} color="#fbbf24" />
              边角相对照度 (暗角)
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                color: '#fcd34d',
                fontWeight: 600,
              }}
            >
              {vignetting.grade}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#f8fafc',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {vignetting.relativeIlluminationPct}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (-{vignetting.evLoss} EV)
            </span>
          </div>
        </div>
      </div>

      {/* 3. 智能光学诊断结论与拍摄建议 */}
      <div
        className="card-glass"
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          borderLeft: '4px solid var(--accent-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lightbulb size={16} color="var(--accent-color)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>光学诊断结论 & 拍摄建议</span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          {diagnosisSummary}
        </p>
        {recommendations.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              paddingTop: '6px',
              borderTop: '1px dashed var(--border-subtle)',
            }}
          >
            {recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  fontSize: '11px',
                  color: '#bae6fd',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
              >
                <span style={{ color: 'var(--accent-color)' }}>•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 交互式 9 宫格像场分布矩阵 */}
      <div className="card-glass" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={15} color="var(--accent-color)" />
            像场 9 区域清晰度分布矩阵
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>悬停可定位画面区域</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {gridLayout.flat().map((zoneId) => {
            if (!zoneId) return null;
            const zone = zoneMap.get(zoneId);
            if (!zone) return null;
            const isCenter = zone.id === 'center';
            const isHovered = activeZoneId === zone.id;

            return (
              <div
                key={zone.id}
                onMouseEnter={() => onHoverZone(zone.id)}
                onMouseLeave={() => onHoverZone(null)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: isHovered
                    ? 'rgba(56, 189, 248, 0.2)'
                    : isCenter
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isHovered
                    ? '1px solid var(--accent-color)'
                    : isCenter
                    ? '1px solid rgba(56, 189, 248, 0.3)'
                    : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isCenter ? 'var(--accent-color)' : 'var(--text-muted)',
                      fontWeight: isCenter ? 700 : 500,
                    }}
                  >
                    {zone.shortName}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, monospace',
                      color:
                        zone.sharpness >= 75
                          ? '#4ade80'
                          : zone.sharpness >= 55
                          ? '#fbbf24'
                          : '#f87171',
                    }}
                  >
                    {zone.sharpness}
                  </span>
                </div>

                {/* 迷你条形指示 */}
                <div
                  style={{
                    height: '3px',
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${zone.sharpness}%`,
                      backgroundColor:
                        zone.sharpness >= 75
                          ? 'var(--success-color)'
                          : zone.sharpness >= 55
                          ? 'var(--warning-color)'
                          : 'var(--danger-color)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 自动检测斜边 (Auto Detected Slanted Edges) */}
      <div className="card-glass" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Crosshair size={15} color="var(--accent-color)" />
            画面斜边自动扫描 ({detectedEdges.length} 处)
          </span>
          <button
            onClick={onSwitchToEdgeMode}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-color)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: 0,
            }}
          >
            切换到斜边模式
            <ChevronRight size={14} />
          </button>
        </div>

        {detectedEdges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {detectedEdges.map((edge) => (
              <div
                key={edge.id}
                onClick={() => onSelectEdge(edge)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                  e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: 'var(--accent-color)',
                      fontWeight: 600,
                    }}
                  >
                    {edge.zoneName}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-color)' }}>
                    倾角 {edge.angleDeg}° · 对比度 {Math.round(edge.contrast * 100)}%
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', color: '#4ade80', fontWeight: 700 }}>
                    MTF50: {edge.mtf50} c/p
                  </span>
                  <ChevronRight size={14} color="var(--text-dim)" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              fontSize: '12px',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            画面为自然场景，未发现孤立标准斜边（全图热力图与 9 宫格评估依然精确有效）
          </div>
        )}
      </div>
    </div>
  );
};
