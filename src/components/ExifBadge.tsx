import React from 'react';
import { Camera, Aperture, Clock, Zap } from 'lucide-react';
import { ParsedExifResult } from '../types/exif';

interface ExifBadgeProps {
  exifResult: ParsedExifResult | null;
  onOpenExifModal: () => void;
}

export const ExifBadge: React.FC<ExifBadgeProps> = ({
  exifResult,
  onOpenExifModal,
}) => {
  if (!exifResult || !exifResult.hasExif) {
    return (
      <button
        onClick={onOpenExifModal}
        className="btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          fontSize: '12px',
          borderRadius: '8px',
          opacity: 0.8,
        }}
        title="查看/读取照片 EXIF 元数据"
      >
        <Camera size={14} />
        <span>EXIF 信息</span>
      </button>
    );
  }

  const { overview } = exifResult;
  const cameraText =
    overview.model || overview.make || '未知相机';
  const focalText = overview.focalLength
    ? `${Math.round(overview.focalLength)}mm`
    : '';
  const fText = overview.fNumber ? `f/${overview.fNumber}` : '';
  const shutterText = overview.exposureTimeString || '';
  const isoText = overview.iso ? `ISO ${overview.iso}` : '';

  return (
    <div
      onClick={onOpenExifModal}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '3px 10px',
        borderRadius: '8px',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontSize: '12px',
        color: 'var(--text-color)',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
      title="点击查看完整 EXIF 元数据与导出 JSON"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.18)';
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-color)', fontWeight: 600 }}>
        <Camera size={14} />
        <span style={{ whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cameraText}
        </span>
      </div>

      {(focalText || fText || shutterText || isoText) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
          <span>•</span>
          {focalText && <span>{focalText}</span>}
          {fText && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#38bdf8' }}>
              <Aperture size={11} />
              {fText}
            </span>
          )}
          {shutterText && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Clock size={11} />
              {shutterText}
            </span>
          )}
          {isoText && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Zap size={11} />
              {isoText}
            </span>
          )}
        </div>
      )}

      <span
        style={{
          marginLeft: '4px',
          padding: '1px 5px',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderRadius: '4px',
          fontSize: '10px',
          color: '#38bdf8',
          fontWeight: 600,
        }}
      >
        EXIF
      </span>
    </div>
  );
};
