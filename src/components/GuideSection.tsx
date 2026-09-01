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
              LensMark 镜头光学画质评估与 ISO 12233 测量原理指南
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
                一、全图光学画质诊断（真实光学相干性与稳健去噪）
              </h3>
            </div>
            <p>
              针对摄影师日常评估镜头成像需求，系统无需拍摄专用测试图。只需导入任意实拍样张（风景、人像、建筑或分辨率砖墙），系统即刻执行：
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>结构张量相干性去噪 (Structure Tensor Coherence)</strong>：严格鉴别具有空间方向连续性的真实光学边缘，彻底过滤随机高频噪点与散粒噪声，杜绝高噪点/老手机马赛克照片产生虚假高锐度。</li>
              <li><strong>MAD 稳健噪声估计与 SNR 量化</strong>：采用中位数绝对偏差计算传感器真实噪声标准差与信噪比 (dB)，自动对噪点污染实施画质惩罚。</li>
              <li><strong>JPEG 8x8 块效应检测与抑制</strong>：检测重度压缩与马赛克伪影，滤除网格跳变带来的虚假边缘。</li>
              <li><strong>物理分辨率标定与封顶 (Resolution Constraints)</strong>：结合原生传感器像素规模严格标定 LW/PH，杜绝低像素老设备得到不切实际的高分。</li>
              <li><strong>九宫格像场解析力矩阵与门控一致性</strong>：对比中心与四角像场，以中心有效锐度为门控计算边缘衰减率。</li>
              <li><strong>ISO 12233 边缘过冲校准 (Overshoot Debias)</strong>：检测手机 ISP 的计算摄影强锐化白边，剥除非光学人工增益。</li>
              <li><strong>色散紫边 (CA) 与暗角 (Vignetting)</strong>：计算亚像素错位与边角 EV 损失。</li>
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
