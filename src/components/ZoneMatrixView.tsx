import React from 'react';
import { ZoneMetric, ROI } from '../types/mtf';

interface ZoneMatrixViewProps {
  zones: ZoneMetric[];
  onSelectZone?: (roi: ROI) => void;
}

export const ZoneMatrixView: React.FC<ZoneMatrixViewProps> = ({ zones, onSelectZone }) => {
  // 9 宫格布局映射: [row0: TL, T, TR], [row1: L, C, R], [row2: BL, B, BR]
  const zoneMap: Record<string, ZoneMetric | undefined> = {};
  zones.forEach((z) => {
    zoneMap[z.id] = z;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'var(--accent-color)';
    if (score >= 75) return 'var(--success-color)';
    if (score >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const renderCell = (id: string, isCenter = false) => {
    const zone = zoneMap[id];
    if (!zone) return <div key={id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }} />;

    const color = getScoreColor(zone.sharpness);

    return (
      <div
        key={id}
        onClick={() => onSelectZone?.(zone.roi)}
        title={`${zone.name} - 解析力得分: ${zone.sharpness} (点击在视口中定位)`}
        style={{
          backgroundColor: isCenter ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)',
          border: isCenter ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          gap: '2px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-color)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isCenter
            ? 'rgba(56, 189, 248, 0.35)'
            : 'var(--border-color)';
          e.currentTarget.style.transform = 'none';
        }}
      >
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
            fontSize: '16px',
            fontWeight: 800,
            fontFamily: 'ui-monospace, monospace',
            color,
          }}
        >
          {zone.sharpness}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
          {zone.colorFringingPx > 0 ? `CA: ${zone.colorFringingPx}px` : `${zone.relativeIllumination}% 光照`}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-color)' }}>
          九宫格像场解析力分布 (Field Matrix)
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>点击单元格定位 ROI</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '6px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {renderCell('top_left')}
        {renderCell('top')}
        {renderCell('top_right')}

        {renderCell('left')}
        {renderCell('center', true)}
        {renderCell('right')}

        {renderCell('bottom_left')}
        {renderCell('bottom')}
        {renderCell('bottom_right')}
      </div>
    </div>
  );
};
