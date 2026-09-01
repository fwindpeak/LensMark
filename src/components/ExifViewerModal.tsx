import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Search,
  Camera,
  Aperture,
  MapPin,
  Info,
  Calendar,
  Compass,
} from 'lucide-react';
import { ParsedExifResult } from '../types/exif';
import { exportExifAsJson, copyExifAsJson } from '../core/exifReader';

interface ExifViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exifResult: ParsedExifResult | null;
  fileName?: string;
}

type TabType = 'overview' | 'sections' | 'rawTable' | 'json';

export const ExifViewerModal: React.FC<ExifViewerModalProps> = ({
  isOpen,
  onClose,
  exifResult,
  fileName = 'photo.jpg',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // 搜索过滤原始标签 (Hook 必须在顶层无条件执行)
  const filteredTags = useMemo(() => {
    if (!exifResult?.rawTags) return [];
    let list = exifResult.rawTags;

    if (selectedSection !== 'all') {
      list = list.filter(
        (t) => t.section?.toLowerCase() === selectedSection.toLowerCase()
      );
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const valMatch = String(t.value).toLowerCase().includes(q);
      const secMatch = t.section?.toLowerCase().includes(q);
      const rawMatch = String(t.rawValue).toLowerCase().includes(q);
      return nameMatch || valMatch || secMatch || rawMatch;
    });
  }, [exifResult, searchQuery, selectedSection]);

  if (!isOpen) return null;

  const handleCopyJson = async () => {
    if (!exifResult) return;
    const ok = await copyExifAsJson(exifResult);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportJson = () => {
    if (!exifResult) return;
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    exportExifAsJson(exifResult, `${baseName}_exif.json`);
  };

  const overview = exifResult?.overview || {};

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="card-glass"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal 顶部 Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(30, 41, 59, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)',
              }}
            >
              <Camera size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  照片 EXIF 元数据
                </h2>
                {exifResult?.hasExif ? (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#4ade80',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                  >
                    已解析 {exifResult.rawTags.length} 个字段
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    未检测到 EXIF 标签
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {fileName}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {exifResult?.hasExif && (
              <>
                <button
                  onClick={handleCopyJson}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '8px',
                  }}
                  title="复制全部 EXIF 结构为 JSON"
                >
                  {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>

                <button
                  onClick={handleExportJson}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '8px',
                  }}
                  title="导出并下载完整 EXIF JSON 文件"
                >
                  <Download size={14} />
                  <span>导出 JSON 文件</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab 导航与搜索框 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor:
                  activeTab === 'overview'
                    ? 'var(--accent-color)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'overview' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              📋 参数概览
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor:
                  activeTab === 'sections'
                    ? 'var(--accent-color)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'sections' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              📑 分类标签 ({exifResult?.sections.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('rawTable')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor:
                  activeTab === 'rawTable'
                    ? 'var(--accent-color)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'rawTable' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              🔬 全部原始标签 ({exifResult?.rawTags.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('json')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor:
                  activeTab === 'json'
                    ? 'var(--accent-color)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'json' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              💻 JSON 源码
            </button>
          </div>

          {/* 搜索框 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '4px 10px',
              minWidth: '220px',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="搜索 Tag 名称、字段或数值..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '12px',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modal 内容区 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {!exifResult?.hasExif ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)',
                gap: '12px',
              }}
            >
              <Info size={40} color="var(--text-muted)" />
              <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                未从该图片中读取到 EXIF 元数据
              </div>
              <p style={{ fontSize: '13px', maxWidth: '440px', textAlign: 'center', margin: 0 }}>
                这通常是因为图片在上传前被社交软件、网页编辑器压缩或抹除了元数据，或当前为内置合成生成样张。
              </p>
            </div>
          ) : activeTab === 'overview' ? (
            /* ================= 1. 结构化概览 ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 四格卡片 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* 1. 机身与镜头 */}
                <div
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-color)', fontSize: '12px', fontWeight: 600 }}>
                    <Camera size={15} />
                    <span>拍摄设备</span>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      {overview.model || overview.make || '未知型号'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {overview.lensModel || '未知镜头 / 原厂一体镜头'}
                    </div>
                    {overview.sensorFormatEstimate && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#38bdf8',
                          marginTop: '6px',
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        }}
                      >
                        {overview.sensorFormatEstimate}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 曝光四要素 */}
                <div
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                    <Aperture size={15} />
                    <span>核心曝光</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>光圈: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.fNumber ? `f/${overview.fNumber}` : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>快门: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.exposureTimeString || '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>ISO: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.iso || '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>曝光补偿: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.exposureCompensation !== undefined
                          ? `${overview.exposureCompensation > 0 ? '+' : ''}${overview.exposureCompensation} EV`
                          : '0 EV'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. 焦距与光学 */}
                <div
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
                    <Compass size={15} />
                    <span>光学与分辨率</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>物理焦距: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.focalLength ? `${overview.focalLength}mm` : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>等效焦距: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.focalLengthIn35mm ? `${overview.focalLengthIn35mm}mm` : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>总像素: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.megapixels ? `${overview.megapixels} MP` : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>色彩空间: </span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>
                        {overview.colorSpace || 'sRGB'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. 时间与附加信息 */}
                <div
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '12px', fontWeight: 600 }}>
                    <Calendar size={15} />
                    <span>拍摄时间与软件</span>
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ color: '#fff', fontWeight: 600 }}>
                      {overview.dateTimeOriginal || '未知拍摄时间'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
                      处理软件: {overview.software || '机身原生直出'}
                    </div>
                    {(overview.gpsLatitude !== undefined && overview.gpsLongitude !== undefined) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontSize: '11px', marginTop: '4px' }}>
                        <MapPin size={12} />
                        <span>
                          {overview.gpsLatitude.toFixed(4)}°, {overview.gpsLongitude.toFixed(4)}°
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 关键信息列表 */}
              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                  主要拍摄元数据明细
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  {[
                    { label: '相机制造商 (Make)', val: overview.make },
                    { label: '相机型号 (Model)', val: overview.model },
                    { label: '镜头型号 (LensModel)', val: overview.lensModel },
                    { label: '光圈值 (F-Number)', val: overview.fNumber ? `f/${overview.fNumber}` : null },
                    { label: '快门速度 (Exposure Time)', val: overview.exposureTimeString },
                    { label: '感光度 (ISO Speed)', val: overview.iso },
                    { label: '焦距 (Focal Length)', val: overview.focalLength ? `${overview.focalLength} mm` : null },
                    { label: '35mm 等效焦距', val: overview.focalLengthIn35mm ? `${overview.focalLengthIn35mm} mm` : null },
                    { label: '曝光程序 (Exposure Program)', val: overview.exposureProgram },
                    { label: '测光模式 (Metering Mode)', val: overview.meteringMode },
                    { label: '白平衡 (White Balance)', val: overview.whiteBalance },
                    { label: '闪光灯 (Flash)', val: overview.flash },
                    { label: '原始图像尺寸', val: overview.imageWidth && overview.imageHeight ? `${overview.imageWidth} × ${overview.imageHeight}` : null },
                    { label: '估算传感器画幅', val: overview.sensorFormatEstimate },
                    { label: '固件/处理软件', val: overview.software },
                    { label: '创作者 / 摄影师', val: overview.artist },
                    { label: '版权信息 (Copyright)', val: overview.copyright },
                  ]
                    .filter((item) => item.val !== undefined && item.val !== null && item.val !== '')
                    .map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                        <span style={{ color: '#fff', fontWeight: 500, textAlign: 'right' }}>
                          {String(item.val)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'sections' ? (
            /* ================= 2. 分类标签页 ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {exifResult.sections.map((sec) => (
                <div
                  key={sec.name}
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                      {sec.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {sec.tags.length} 个字段
                    </span>
                  </div>

                  <div style={{ padding: '8px 16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 4px', width: '30%' }}>Tag 名称</th>
                          <th style={{ padding: '8px 4px', width: '50%' }}>解析值 / 描述</th>
                          <th style={{ padding: '8px 4px', width: '20%' }}>原始值 (Raw)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.tags.map((tag, tIdx) => (
                          <tr
                            key={tIdx}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                            }}
                          >
                            <td style={{ padding: '7px 4px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                              {tag.name}
                            </td>
                            <td style={{ padding: '7px 4px', color: '#fff' }}>
                              {String(tag.value)}
                            </td>
                            <td style={{ padding: '7px 4px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                              {tag.rawValue !== undefined ? String(tag.rawValue) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'rawTable' ? (
            /* ================= 3. 全部原始标签表 ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  共检索到 {filteredTags.length} 个标签项
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['all', 'ifd0', 'exif', 'gps', 'makerNote', 'xmp', 'icc'].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setSelectedSection(sec)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor:
                          selectedSection === sec
                            ? 'var(--accent-color)'
                            : 'rgba(255, 255, 255, 0.06)',
                        color: selectedSection === sec ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 2 }}>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', width: '22%' }}>标签键名 (Key)</th>
                        <th style={{ padding: '10px 12px', width: '15%' }}>所属分段</th>
                        <th style={{ padding: '10px 12px', width: '38%' }}>解析/展示值 (Value)</th>
                        <th style={{ padding: '10px 12px', width: '25%' }}>原始值 (Raw Value)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTags.map((tag, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                            {tag.name}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              {tag.section || 'EXIF'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#fff', wordBreak: 'break-all' }}>
                            {String(tag.value)}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                            {tag.rawValue !== undefined ? String(tag.rawValue) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ================= 4. JSON 视图 ================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  完整 EXIF 树形结构 JSON (可直接复制或导出文件)
                </span>
                <button
                  onClick={handleCopyJson}
                  className="btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    borderRadius: '6px',
                  }}
                >
                  {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#020617',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  maxHeight: '52vh',
                  overflow: 'auto',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#38bdf8',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    lineHeight: '1.5',
                  }}
                >
                  {exifResult.rawJsonString}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
