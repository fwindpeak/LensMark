import React from 'react';
import { BookOpen, CheckCircle, X } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="card-glass"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0f172a',
          padding: '24px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="var(--accent-color)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
              ISO 12233 斜边测量原理与使用指南
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              1. 什么是斜边 MTF / SFR 测量法？
            </h3>
            <p>
              斜边法（Slanted-Edge Method，ISO 12233 标准）是目前数码相机、手机镜头与机器视觉中最权威的光学解像力测试方法。通过微小倾斜（5°~10°）的黑白边缘，利用相邻行采样点的亚像素相位错位，将相机的有效采样率提升 4 倍（超采样），克服了数字图像感光阵列 Nyquist 采样极限。
            </p>
          </div>

          <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '6px' }}>
              2. 算法计算管线
            </h3>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>sRGB 线性化</strong>：应用 Gamma 2.2 逆变换解算真实相对光强 $L = sRGB^{2.2}$。</li>
              <li><strong>边缘检测与拟合</strong>：计算各行导数质心并进行最小二乘法直线拟合 $x = ky + b$。</li>
              <li><strong>4x 超采样 ESF</strong>：计算像素到斜边的法向投影距离并以 1/4 像素分箱。</li>
              <li><strong>LSF 求导与加窗</strong>：差分得到线扩散函数 (LSF)，并施加 128 点汉宁窗减少频域泄露。</li>
              <li><strong>DFT 与 MTF50</strong>：执行一维离散傅里叶变换，求取对比度降至 50% 时的空间频率 (cycles/pixel)。</li>
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              3. 照片拍摄与选区框选建议
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={16} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>拍摄格式</strong>：尽量使用 RAW 格式并在转码时关闭一切锐化 (Sharpening) 与降噪 (Noise Reduction)。</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={16} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>倾斜角度</strong>：确保黑白边缘与像素网格有 5°~10° 夹角。过小会导致超采样失效，过大会影响一维近似。</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={16} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>ROI 选区</strong>：框选时边缘两侧应各保留充分的纯亮/纯暗背景，避免包含图样边角、反光或杂乱纹理。</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--accent-color)',
              color: '#0b1120',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
