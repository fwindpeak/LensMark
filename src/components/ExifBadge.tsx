import React from 'react';
import { Camera, Aperture, Clock, Zap, Disc, FileText } from 'lucide-react';
import type { ParsedExifResult } from '../types/exif';

export const ExifBadge: React.FC<{
  exifResult: ParsedExifResult | null;
  onOpenExifModal: () => void;
}> = ({ exifResult, onOpenExifModal }) => {
  const overview = exifResult?.overview;
  const fText = overview?.fNumber ? `f/${overview.fNumber}` : null;
  const shutterText = overview?.exposureTimeString || null;
  const isoText = overview?.iso ? `ISO ${overview.iso}` : null;
  const focalText = overview?.focalLength ? `${Math.round(overview.focalLength)}mm` : null;
  const cameraText = overview?.model || overview?.make || null;
  const lensText = overview?.lensModel || null;

  const hasTriangle = Boolean(fText || shutterText || isoText);

  return (
    <div
      className="exposure-triangle-bar"
      onClick={onOpenExifModal}
      title="点击查看完整 EXIF 元数据与导出 JSON"
    >
      <div className="exposure-tags">
        {cameraText && (
          <span className="exp-tag camera" title={`相机: ${cameraText}`}>
            <Camera size={13} />
            <b>{cameraText}</b>
          </span>
        )}
        {lensText && (
          <span className="exp-tag lens" title={`镜头: ${lensText}`}>
            <Disc size={13} />
            <span>{lensText}</span>
          </span>
        )}
        {focalText && (
          <span className="exp-tag focal" title={`物理焦距: ${focalText}`}>
            <span>{focalText}</span>
          </span>
        )}
        {fText && (
          <span className="exp-tag aperture" title={`光圈: ${fText}`}>
            <Aperture size={13} />
            <b>{fText}</b>
          </span>
        )}
        {shutterText && (
          <span className="exp-tag shutter" title={`快门速度: ${shutterText}`}>
            <Clock size={13} />
            <b>{shutterText}</b>
          </span>
        )}
        {isoText && (
          <span className="exp-tag iso" title={`感光度: ${isoText}`}>
            <Zap size={13} />
            <b>{isoText}</b>
          </span>
        )}
        {!hasTriangle && !cameraText && (
          <span className="exp-tag fallback">
            <Camera size={13} />
            <span>无 EXIF 曝光参数（合成/无元数据照片）</span>
          </span>
        )}
      </div>
      <button
        className="quiet exp-more-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpenExifModal();
        }}
      >
        <FileText size={12} />
        <span>完整 EXIF</span>
      </button>
    </div>
  );
};

