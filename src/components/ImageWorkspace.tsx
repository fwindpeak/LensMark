import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ROI } from '../types/mtf';
import { Crop, UploadCloud, RotateCcw } from 'lucide-react';

interface ImageWorkspaceProps {
  image: HTMLImageElement | null;
  roi: ROI;
  onRoiChange: (roi: ROI) => void;
  onDropFile: (file: File) => void;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  image,
  roi,
  onRoiChange,
  onDropFile,
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

  // 重绘图片与 ROI 选框
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布并绘制主图
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    // 绘制暗色遮罩（高亮选区）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 重新挖空并绘制选区原图
    const rx = Math.floor(currentRoi.x);
    const ry = Math.floor(currentRoi.y);
    const rw = Math.floor(currentRoi.w);
    const rh = Math.floor(currentRoi.h);

    if (rw > 0 && rh > 0) {
      ctx.drawImage(image, rx, ry, rw, rh, rx, ry, rw, rh);

      // 绘制选区边框与半透明填充
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.5, Math.floor(canvas.width / 400));
      ctx.strokeRect(rx, ry, rw, rh);

      // 绘制 4 个角标强化科技感
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
  }, [image, currentRoi]);

  // 当图片或选区变化时重绘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    redraw();
  }, [image, currentRoi, redraw]);

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
      // 还原为前一个有效选区
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
    const rw = Math.min(200, Math.floor(imgW * 0.4));
    const rh = Math.min(200, Math.floor(imgH * 0.4));
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
        minHeight: '520px',
      }}
    >
      {/* 视口顶部状态条 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crop size={16} color="var(--accent-color)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-color)' }}>
            图像视口 & ROI 区域框选
          </span>
          {image && (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              ({image.naturalWidth || image.width} × {image.naturalHeight || image.height} px)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--accent-color)',
              fontFamily: 'ui-monospace, monospace',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.2)',
            }}
          >
            选区: {Math.round(currentRoi.w)} × {Math.round(currentRoi.h)} px (X:{Math.round(currentRoi.x)}, Y:{Math.round(currentRoi.y)})
          </span>

          <button
            onClick={handleCenterRoi}
            title="居中重置选区"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
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
          cursor: isSelecting ? 'crosshair' : 'crosshair',
          border: isDragOver ? '2px dashed var(--accent-color)' : '1px solid var(--border-color)',
          transition: 'border 0.2s',
        }}
      >
        {isDragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        >
          💡 鼠标按住左键在斜边区域拖拽框选 ROI · 边缘两侧保留黑白缓冲
        </div>
      </div>
    </div>
  );
};
