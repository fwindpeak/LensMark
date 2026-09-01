import React, { useRef, useState } from 'react';
import {
  Upload,
  Sparkles,
  HelpCircle,
  Activity,
  ChevronDown,
  Crop,
} from 'lucide-react';
import { AnalysisMode } from '../types/mtf';
import { ParsedExifResult } from '../types/exif';
import { SAMPLE_PRESETS, SamplePreset } from '../core/sampleImages';
import { ExifBadge } from './ExifBadge';

interface HeaderProps {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  onFileUpload: (file: File) => void;
  onSelectSample: (preset: SamplePreset) => void;
  onToggleGuide: () => void;
  onOpenExif?: () => void;
  exifResult?: ParsedExifResult | null;
  fileName?: string;
  isSynthetic?: boolean;
  isRaw?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  onFileUpload,
  onSelectSample,
  onToggleGuide,
  onOpenExif,
  exifResult,
  fileName,
  isSynthetic,
  isRaw,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      {/* 品牌与标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px var(--accent-glow)',
            flexShrink: 0,
          }}
        >
          <Activity size={22} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: 0,
              }}
            >
              LensMark 镜头成像质量评估与 MTF 分析器
            </h1>
            {fileName && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: isRaw
                    ? 'rgba(168, 85, 247, 0.15)'
                    : isSynthetic
                    ? 'rgba(56, 189, 248, 0.15)'
                    : 'rgba(74, 222, 128, 0.15)',
                  color: isRaw ? '#c084fc' : isSynthetic ? 'var(--accent-color)' : 'var(--success-color)',
                  border: `1px solid ${
                    isRaw
                      ? 'rgba(168, 85, 247, 0.3)'
                      : isSynthetic
                      ? 'rgba(56, 189, 248, 0.3)'
                      : 'rgba(74, 222, 128, 0.3)'
                  }`,
                  fontWeight: 600,
                  maxWidth: '220px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fileName}
              </span>
            )}

            {/* EXIF 参数与详情入口徽章 */}
            {onOpenExif && (
              <ExifBadge exifResult={exifResult || null} onOpenExifModal={onOpenExif} />
            )}
          </div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              margin: '2px 0 0 0',
            }}
          >
            实拍照片镜头成像素质评估 · 稳健相干去噪 · 9 像场对比 · 色散紫边/暗角检测 · ISO 12233 斜边 MTF
          </p>
        </div>
      </div>

      {/* 核心操作工具栏 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 模式分段切换器 */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            gap: '2px',
          }}
        >
          <button
            onClick={() => onModeChange('photo_quality')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'photo_quality' ? 'var(--accent-color)' : 'transparent',
              color: mode === 'photo_quality' ? '#0b1120' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            📸 照片质量
          </button>
          <button
            onClick={() => onModeChange('lens_performance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'lens_performance' ? 'var(--accent-color)' : 'transparent',
              color: mode === 'lens_performance' ? '#0b1120' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            🔬 镜头表现
          </button>
          <button
            onClick={() => onModeChange('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'overview' ? 'var(--accent-color)' : 'transparent',
              color: mode === 'overview' ? '#0b1120' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            ⚖️ 双维综合
          </button>
          <button
            onClick={() => onModeChange('slanted_edge')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'slanted_edge' ? 'var(--accent-color)' : 'transparent',
              color: mode === 'slanted_edge' ? '#0b1120' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            <Crop size={13} />
            斜边 MTF
          </button>
        </div>

        {/* 导入实拍照片后一键调回标板样张快捷按钮 */}
        {!isSynthetic && (
          <button
            onClick={() => onSelectSample(SAMPLE_PRESETS[0])}
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            title="一键重置并载入标准 ISO 12233 测试标板"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)')}
          >
            🎯 调回标板样张
          </button>
        )}

        {/* 预设样张体验下拉菜单 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={14} color="var(--accent-color)" />
            预设样张体验
            <ChevronDown size={12} />
          </button>

          {showPresetsMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '240px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectSample(preset);
                    setShowPresetsMenu(false);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    color: 'var(--text-color)',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{preset.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{preset.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 导入照片按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: 'var(--accent-color)',
            color: '#0b1120',
            border: 'none',
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-color)')}
        >
          <Upload size={14} strokeWidth={2.5} />
          导入实拍照片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.arw,.cr2,.cr3,.nef,.nrw,.dng,.raf,.orf,.rw2,.pef,.srw,.3fr,.mef,.mrw,.raw"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* 帮助与说明 */}
        <button
          onClick={onToggleGuide}
          title="使用说明与算法原理"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            padding: '7px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.borderColor = 'var(--text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </header>
  );
};
