import React from 'react';
import { BookOpen, CheckCircle, X, Sparkles, Activity, Layers } from 'lucide-react';

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
          maxWidth: '720px',
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
              镜头光学画质评估与 ISO 12233 测量原理指南
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
          {/* 模式 1 说明 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Sparkles size={16} color="var(--accent-color)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
                一、全图光学画质诊断（真实光学 MTF 与去过冲校准）
              </h3>
            </div>
            <p>
              针对摄影师日常评估镜头成像需求，系统无需拍摄专用测试图。只需导入任意实拍样张（风景、人像、建筑或分辨率砖墙），系统即刻执行：
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>九宫格像场解析力矩阵</strong>：测量中心区域（Center 0~30% 像场）与四角边缘（70~100% 像场）高频能量。</li>
              <li><strong>ISO 12233 边缘过冲与机内锐化校准 (Overshoot Debias)</strong>：检测手机 ISP 的计算摄影强锐化白边（过冲峰），自动剥除非光学人工增益，还原镜头真实光学解析力。</li>
              <li><strong>显著纹理掩模 (Salient Masking)</strong>：自动识别并聚焦在有效纹理/景深对焦区，避免因边角包含平坦天空、纯色或虚化散景（Bokeh）而误判镜头素质。</li>
              <li><strong>总画面解析力 (LW/PH)</strong>：结合原生传感器像素规模，真实呈现全画幅高像素与大底镜头的细节容量。</li>
              <li><strong>色散与紫边 (CA)</strong>：分析高反差边界 R-G 与 B-G 通道亚像素错位与紫边比例。</li>
              <li><strong>暗角与相对照度</strong>：评估四角相对中心的光照衰减与 EV 损失。</li>
            </ul>
          </div>

          {/* 模式 2 说明 */}
          <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Activity size={16} color="var(--accent-color)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-color)', margin: 0 }}>
                二、ISO 12233 标板分析与自动斜边探测
              </h3>
            </div>
            <p style={{ marginBottom: '8px' }}>
              专为标准分辨率测试标板（如 ISO 12233 SFR 靶图）设计：
            </p>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>智能斜边搜索</strong>：全图自动扫描并标出所有 3°~30° 的有效倾斜边缘徽章，点击一键聚焦计算。</li>
              <li><strong>sRGB 物理光强线性化</strong>：应用 Gamma 逆变换解算感光元件接收的物理光通量。</li>
              <li><strong>4x 超采样 ESF</strong>：利用微斜边缘相位差实现 4 倍超采样，突破传感器 Nyquist 极限。</li>
              <li><strong>汉宁窗 LSF 与 DFT 频域响应</strong>：差分获得点扩散线剖面，傅里叶变换解算出完整 MTF 曲线与 MTF50 锐度值。</li>
            </ul>
          </div>

          {/* EXIF 元数据说明 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <BookOpen size={16} color="#38bdf8" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
                三、完整 EXIF 元数据提取与 JSON 导出
              </h3>
            </div>
            <p>
              支持深度解析相机与镜头的全量元数据：包括 IFD0、ExifIFD、GPS、厂商私有 MakerNote、XMP、IPTC、ICC 色彩配置文件等全部段。
              支持实时多维度搜索、一键复制以及<strong>导出完整 JSON 文件</strong>；对于未知或私有厂商 Tag 均保留原始 Raw 键值以供查验。
            </p>
          </div>

          {/* 拍摄建议 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Layers size={16} color="var(--success-color)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
                三、镜头测试实战建议
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={14} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>RAW 原图导出</strong>：关闭机内或后期软件中的锐化 (Sharpening) 与降噪，以反映镜头最纯粹的光学性能。</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={14} color="var(--success-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span><strong>光圈多档对比</strong>：在相同构图下分别拍摄最大光圈（如 f/1.4、f/2.8）与最佳光圈（f/5.6、f/8），对比边缘衰减率与色散变化。</span>
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
