import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ROI, HeatmapGrid, DetectedEdge, ZoneMetric, AnalysisMode } from '../types/mtf';
import {
  Crop,
  UploadCloud,
  RotateCcw,
  Flame,
  Sliders,
  Crosshair,
  Maximize2,
} from 'lucide-react';

interface ImageWorkspaceProps {
  image: HTMLImageElement | null;
  roi: ROI;
  mode: AnalysisMode;
  heatmap: HeatmapGrid | null;
  showHeatmap: boolean;
  heatmapOpacity: number;
  detectedEdges: DetectedEdge[];
  showEdgeBadges: boolean;
  activeZoneId: string | null;
  zones: ZoneMetric[];
  onRoiChange: (roi: ROI) => void;
  onDropFile: (file: File) => void;
  onToggleHeatmap: (show: boolean) => void;
  onChangeHeatmapOpacity: (opacity: number) => void;
  onToggleEdgeBadges: (show: boolean) => void;
  onSelectDetectedEdge: (edge: DetectedEdge) => void;
}

/**
 * Turbo / Jet 科学色彩映射 (0.0 ~ 1.0 -> RGBA)
 */
function getTurboColor(val: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, val));
  let r = 0;
  let g = 0;
  let b = 0;

  if (v < 0.25) {
    // 蓝 -> 青
    const t = v / 0.25;
    r = Math.round(15 * (1 - t) + 6 * t);
    g = Math.round(23 * (1 - t) + 182 * t);
    b = Math.round(180 * (1 - t) + 212 * t);
  } else if (v < 0.5) {
    // 青 -> 绿
    const t = (v - 0.25) / 0.25;
    r = Math.round(6 * (1 - t) + 74 * t);
    g = Math.round(182 * (1 - t) + 222 * t);
    b = Math.round(212 * (1 - t) + 128 * t);
  } else if (v < 0.75) {
    // 绿 -> 黄
    const t = (v - 0.5) / 0.25;
    r = Math.round(74 * (1 - t) + 251 * t);
    g = Math.round(222 * (1 - t) + 191 * t);
    b = Math.round(128 * (1 - t) + 36 * t);
  } else {
    // 黄 -> 艳红
    const t = (v - 0.75) / 0.25;
    r = Math.round(251 * (1 - t) + 239 * t);
    g = Math.round(191 * (1 - t) + 68 * t);
    b = Math.round(36 * (1 - t) + 68 * t);
  }

  return [r, g, b];
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  image,
  roi,
  mode,
  heatmap,
  showHeatmap,
  heatmapOpacity,
  detectedEdges,
  showEdgeBadges,
  activeZoneId,
  zones,
  onRoiChange,
  onDropFile,
  onToggleHeatmap,
  onChangeHeatmapOpacity,
  onToggleEdgeBadges,
  onSelectDetectedEdge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [currentRoi, setCurrentRoi] = useState<ROI>(roi);
  const [isDragOver, setIsDragOver] = useState(false);

  // 同步外部 roi
  useEffect(() => {
    setCurrentRoi(roi);
  }, [roi]);

  // 获取 Canvas 坐标体系中的图片实际像素坐标
  const getImageCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
      };
    },
    [image]
  );

  // 重绘图片、热力图、ROI 与标记
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. 清除画布并绘制主图
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);

    // 2. 绘制全图清晰度热力图 (如果开启)
    if (showHeatmap && heatmap && heatmap.data.length > 0) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = heatmap.cols;
      offCanvas.height = heatmap.rows;
      const offCtx = offCanvas.getContext('2d');

      if (offCtx) {
        const offImgData = offCtx.createImageData(heatmap.cols, heatmap.rows);
        const imgD = offImgData.data;

        for (let i = 0; i < heatmap.data.length; i++) {
          const val = heatmap.data[i];
          const [r, g, b] = getTurboColor(val);
          const p = i * 4;
          imgD[p] = r;
          imgD[p + 1] = g;
          imgD[p + 2] = b;
          imgD[p + 3] = Math.round(230 * val); // 高锐度区域更显眼
        }

        offCtx.putImageData(offImgData, 0, 0);

        // 平滑缩放叠加至主画布
        ctx.save();
        ctx.globalAlpha = heatmapOpacity;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offCanvas, 0, 0, w, h);
        ctx.restore();
      }
    }

    // 3. 绘制 Hover 激活的像场分区高亮框
    if (activeZoneId) {
      const activeZone = zones.find((z) => z.id === activeZoneId);
      if (activeZone && activeZone.roi) {
        const { x, y, w: zw, h: zh } = activeZone.roi;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(x, y, zw, zh);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(2, Math.floor(w / 300));
        ctx.strokeRect(x, y, zw, zh);

        // 像场文本标签
        ctx.font = `bold ${Math.max(14, Math.floor(w / 40))}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(`${activeZone.name} (${activeZone.sharpness}分)`, x + 12, y + 28);
        ctx.restore();
      }
    }

    // 4. 斜边测量模式下，绘制暗色遮罩与高亮 ROI 选区
    if (mode === 'slanted_edge') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, w, h);

      const rx = Math.floor(currentRoi.x);
      const ry = Math.floor(currentRoi.y);
      const rw = Math.floor(currentRoi.w);
      const rh = Math.floor(currentRoi.h);

      if (rw > 0 && rh > 0) {
        ctx.drawImage(image, rx, ry, rw, rh, rx, ry, rw, rh);

        // 选区边框与填充
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(1.5, Math.floor(w / 400));
        ctx.strokeRect(rx, ry, rw, rh);

        // 4 个科技感角标
        const cornerLen = Math.min(12, Math.min(rw, rh) / 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, ctx.lineWidth + 0.5);

        // 左上
        ctx.beginPath();
        ctx.moveTo(rx, ry + cornerLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + cornerLen, ry);
        ctx.stroke();

        // 右上
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + cornerLen);
        ctx.stroke();

        // 左下
        ctx.beginPath();
        ctx.moveTo(rx, ry + rh - cornerLen);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx + cornerLen, ry + rh);
        ctx.stroke();

        // 右下
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerLen, ry + rh);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw, ry + rh - cornerLen);
        ctx.stroke();
      }
    }

    // 5. 绘制自动检测到的斜边角标 (在全图或斜边模式均可显示)
    if (showEdgeBadges && detectedEdges.length > 0) {
      detectedEdges.forEach((edge) => {
        const { x, y, w: ew, h: eh } = edge.roi;
        ctx.save();

        // 虚线框标注
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, ew, eh);

        // 顶部小徽章标签
        const badgeText = `${edge.zoneName} · MTF50: ${edge.mtf50}`;
        ctx.font = 'bold 11px system-ui, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.setLineDash([]);
        ctx.fillRect(x, Math.max(0, y - 22), textWidth + 16, 20);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, Math.max(0, y - 22), textWidth + 16, 20);

        ctx.fillStyle = '#4ade80';
        ctx.fillText(badgeText, x + 8, Math.max(14, y - 8));

        ctx.restore();
      });
    }
  }, [
    image,
    mode,
    currentRoi,
    heatmap,
    showHeatmap,
    heatmapOpacity,
    activeZoneId,
    zones,
    showEdgeBadges,
    detectedEdges,
  ]);

  // 当图片或配置变化时重绘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    redraw();
  }, [image, redraw]);

  // 鼠标交互事件
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return;
    const pos = getImageCoords(e);
    if (!pos) return;

    setIsSelecting(true);
    setStartPos(pos);
    const newRoi = { x: pos.x, y: pos.y, w: 0, h: 0 };
    setCurrentRoi(newRoi);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !image) return;
    const pos = getImageCoords(e);
    if (!pos) return;

    const x = Math.max(0, Math.min(startPos.x, pos.x));
    const y = Math.max(0, Math.min(startPos.y, pos.y));
    const w = Math.min((canvasRef.current?.width || 0) - x, Math.abs(pos.x - startPos.x));
    const h = Math.min((canvasRef.current?.height || 0) - y, Math.abs(pos.y - startPos.y));

    setCurrentRoi({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    if (currentRoi.w >= 10 && currentRoi.h >= 10) {
      onRoiChange(currentRoi);
    } else {
      // 检查是否单点了某个自动识别的斜边
      if (showEdgeBadges && detectedEdges.length > 0) {
        const clickedEdge = detectedEdges.find((edge) => {
          const { x, y, w: ew, h: eh } = edge.roi;
          return (
            startPos.x >= x - 10 &&
            startPos.x <= x + ew + 10 &&
            startPos.y >= y - 30 &&
            startPos.y <= y + eh + 10
          );
        });
        if (clickedEdge) {
          onSelectDetectedEdge(clickedEdge);
          return;
        }
      }
      setCurrentRoi(roi);
    }
  };

  // 拖拽文件进入
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onDropFile(file);
    }
  };

  // 居中复位选区
  const handleCenterRoi = () => {
    if (!image) return;
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    const rw = Math.min(240, Math.floor(imgW * 0.4));
    const rh = Math.min(240, Math.floor(imgH * 0.4));
    const newRoi = {
      x: Math.floor((imgW - rw) / 2),
      y: Math.floor((imgH - rh) / 2),
      w: rw,
      h: rh,
    };
    onRoiChange(newRoi);
  };

  return (
    <div
      ref={containerRef}
      className="card-glass"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        position: 'relative',
        minHeight: '560px',
      }}
    >
      {/* 视口顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: mode === 'overview' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
              color: mode === 'overview' ? 'var(--accent-color)' : '#c084fc',
              border: `1px solid ${mode === 'overview' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {mode === 'overview' ? <Maximize2 size={13} /> : <Crop size={13} />}
            {mode === 'overview' ? '全图像场视口' : '斜边 ROI 测量'}
          </div>

          {image && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {image.naturalWidth || image.width} × {image.naturalHeight || image.height} px
            </span>
          )}
        </div>

        {/* 热力图 & 标记开关控制组 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 热力图切换 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: showHeatmap ? 'var(--accent-color)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => onToggleHeatmap(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
              />
              <Flame size={14} />
              清晰度热力图
            </label>

            {showHeatmap && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                <Sliders size={11} color="var(--text-dim)" />
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={heatmapOpacity}
                  onChange={(e) => onChangeHeatmapOpacity(parseFloat(e.target.value))}
                  title="调节热力图透明度"
                  style={{ width: '60px', height: '4px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>

          {/* 自动斜边标记切换 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: showEdgeBadges ? '#4ade80' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <input
              type="checkbox"
              checked={showEdgeBadges}
              onChange={(e) => onToggleEdgeBadges(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#4ade80' }}
            />
            <Crosshair size={14} />
            显示斜边标靶
          </label>

          {/* 居中选区按钮 */}
          <button
            onClick={handleCenterRoi}
            title="居中重置选区"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <RotateCcw size={12} />
            居中选区
          </button>
        </div>
      </div>

      {/* 主 Canvas 渲染区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          marginTop: '12px',
          backgroundColor: '#000000',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'crosshair',
          border: isDragOver ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
          transition: 'border 0.2s',
        }}
      >
        {isDragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              zIndex: 30,
            }}
          >
            <UploadCloud size={48} color="var(--accent-color)" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>释放鼠标以加载照片</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
          }}
        />

        {/* 底部悬浮提示 */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💡 随时可在画面中按住左键拖拽框选自定义区域</span>
          {showHeatmap && (
            <span style={{ color: '#fcd34d', borderLeft: '1px solid #334155', paddingLeft: '8px' }}>
              🔥 热力图：红/黄代表高锐度解析，绿/蓝代表软化或平坦
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
