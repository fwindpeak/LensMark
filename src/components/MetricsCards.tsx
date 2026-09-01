import React from 'react';
import { MTFResult } from '../types/mtf';
import { Award, Compass, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MetricsCardsProps {
  result: MTFResult | null;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ result }) => {
  if (!result || !result.isValid) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#fca5a5',
          fontSize: '13px',
        }}
      >
        <AlertTriangle size={20} color="var(--danger-color)" />
        <div>
          <div style={{ fontWeight: 600, color: 'var(--danger-color)' }}>未检测到有效斜边</div>
          <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '2px' }}>
            {result?.errorMessage || '请在包含 5°~10° 倾斜明暗反差边缘的区域拖拽框选 ROI'}
          </div>
        </div>
      </div>
    );
  }

  const { mtf50, angleDeg, edgeCount, totalRows } = result;

  // 评估 MTF50 品质
  let mtfRating = { label: '优秀', color: 'var(--success-color)' };
  if (mtf50 >= 0.35) {
    mtfRating = { label: '卓越 (极高解析)', color: '#38bdf8' };
  } else if (mtf50 >= 0.25) {
    mtfRating = { label: '良好 (高锐度)', color: '#4ade80' };
  } else if (mtf50 >= 0.15) {
    mtfRating = { label: '普通 (标准)', color: '#fbbf24' };
  } else {
    mtfRating = { label: '偏软 (低反差)', color: '#f87171' };
  }

  // 评估角度适宜性 (ISO 12233 推荐 5°~10°)
  const isAngleIdeal = angleDeg >= 4.0 && angleDeg <= 12.0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {/* MTF50 指标 */}
      <div
        className="card-glass"
        style={{
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={14} color="var(--accent-color)" />
            MTF50 空间频率锐度
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              color: mtfRating.color,
              fontWeight: 600,
            }}
          >
            {mtfRating.label}
          </span>
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--accent-color)',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '-0.02em',
            }}
          >
            {mtf50 > 0 ? mtf50.toFixed(3) : '> 0.5'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>cycles/pixel</span>
        </div>
      </div>

      {/* 边缘倾斜角度 */}
      <div
        className="card-glass"
        style={{
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={14} color="var(--accent-color)" />
            斜边倾角 (Slant Angle)
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: isAngleIdeal ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)',
              color: isAngleIdeal ? 'var(--success-color)' : 'var(--warning-color)',
              fontWeight: 600,
            }}
          >
            {isAngleIdeal ? '符合 ISO 规范' : '建议 5°~10°'}
          </span>
        </div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#f8fafc',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '-0.02em',
            }}
          >
            {angleDeg.toFixed(2)}
          </span>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>°</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={12} color="var(--success-color)" />
            {edgeCount}/{totalRows} 行拟合
          </span>
        </div>
      </div>
    </div>
  );
};
