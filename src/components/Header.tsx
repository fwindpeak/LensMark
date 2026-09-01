import React, { useRef } from 'react';
import { Upload, Sparkles, HelpCircle, Activity } from 'lucide-react';

interface HeaderProps {
  onFileUpload: (file: File) => void;
  onGenerateSynthetic: () => void;
  onToggleGuide: () => void;
  fileName?: string;
  isSynthetic?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onFileUpload,
  onGenerateSynthetic,
  onToggleGuide,
  fileName,
  isSynthetic,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      // 重置 input 以允许连续上传相同文件
      e.target.value = '';
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <Activity size={22} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: 0,
              }}
            >
              ISO 12233 浏览器端斜边 MTF / SFR 测量分析器
            </h1>
            {fileName && (
              <span
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: isSynthetic ? 'rgba(56, 189, 248, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                  color: isSynthetic ? 'var(--accent-color)' : 'var(--success-color)',
                  border: `1px solid ${isSynthetic ? 'var(--accent-color)' : 'var(--success-color)'}`,
                  fontWeight: 500,
                }}
              >
                {fileName}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            纯前端物理光强线性化 · 亚像素导数质心拟合 · 4x 超采样 ESF · 汉宁窗 LSF 频域解算
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            backgroundColor: 'var(--accent-color)',
            color: '#0b1120',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-color)')}
        >
          <Upload size={16} strokeWidth={2.5} />
          导入照片 (JPG/PNG/TIFF)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          onClick={onGenerateSynthetic}
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.color = 'var(--accent-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-color)';
          }}
        >
          <Sparkles size={15} />
          生成模拟斜边
        </button>

        <button
          onClick={onToggleGuide}
          title="使用说明与原理"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '13px',
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
          <HelpCircle size={18} />
        </button>
      </div>
    </header>
  );
};
