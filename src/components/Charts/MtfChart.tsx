import React, { useEffect, useRef, useState } from 'react';
import { MTFResult } from '../../types/mtf';

interface MtfChartProps {
  result: MTFResult | null;
}

export const MtfChart: React.FC<MtfChartProps> = ({ result }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverData, setHoverData] = useState<{ freq: number; mtf: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const padL = 42;
      const padR = 20;
      const padT = 24;
      const padB = 26;
      const plotW = Math.max(10, width - padL - padR);
      const plotH = Math.max(10, height - padT - padB);

      // 绘制背景网格
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#64748b';

      // Y 轴刻度 (0.0, 0.5, 1.0)
      for (let v = 0; v <= 1.0; v += 0.25) {
        const y = padT + plotH * (1 - v);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(2), 6, y + 3);
      }

      // X 轴频率刻度 (0.0 到 0.5 cycles/pixel)
      const maxFreq = 0.5;
      for (let f = 0; f <= maxFreq; f += 0.1) {
        const x = padL + (f / maxFreq) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.fillText(`${f.toFixed(1)}`, x - 8, height - 8);
      }

      // X 轴单位
      ctx.fillText('(cycles/pixel)', width - padR - 60, height - 8);

      if (!result || !result.isValid || !result.mtf || result.mtf.length === 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('等待有效数据...', padL + plotW / 2, padT + plotH / 2);
        return;
      }

      const { mtf, mtf50, winLen, oversampling } = result;

      // 绘制 0.5 对比度基准线 (红色虚线)
      const y50 = padT + plotH * 0.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.5)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y50);
      ctx.lineTo(width - padR, y50);
      ctx.stroke();
      ctx.restore();

      // MTF50 交叉点与垂线
      if (mtf50 > 0 && mtf50 <= maxFreq) {
        const xMtf50 = padL + (mtf50 / maxFreq) * plotW;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(xMtf50, padT);
        ctx.lineTo(xMtf50, padT + plotH);
        ctx.stroke();
        ctx.restore();

        // 绘制 MTF50 焦点圆圈
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(xMtf50, y50, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 绘制渐变填充曲线
      const gradient = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      ctx.beginPath();
      let firstX = padL;
      let lastX = padL;

      for (let i = 0; i < mtf.length; i++) {
        const freq = (i / winLen) * oversampling;
        if (freq > maxFreq) break;
        const x = padL + (freq / maxFreq) * plotW;
        const val = Math.max(0, Math.min(1.2, mtf[i]));
        const y = padT + (1 - val) * plotH;

        if (i === 0) {
          firstX = x;
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
      }

      // 闭合区域做渐变填充
      ctx.save();
      ctx.lineTo(lastX, padT + plotH);
      ctx.lineTo(firstX, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // 绘制曲线描边
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < mtf.length; i++) {
        const freq = (i / winLen) * oversampling;
        if (freq > maxFreq) break;
        const x = padL + (freq / maxFreq) * plotW;
        const val = Math.max(0, Math.min(1.2, mtf[i]));
        const y = padT + (1 - val) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [result]);

  // 处理鼠标悬浮高亮
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!result || !result.isValid || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padL = 42;
    const padR = 20;
    const plotW = containerRef.current.clientWidth - padL - padR;
    const maxFreq = 0.5;

    if (x >= padL && x <= padL + plotW) {
      const freq = ((x - padL) / plotW) * maxFreq;
      // 寻找最接近的 MTF 数据点
      const idx = Math.round((freq / result.oversampling) * result.winLen);
      if (idx >= 0 && idx < result.mtf.length) {
        setHoverData({
          freq,
          mtf: result.mtf[idx],
          x,
          y,
        });
        return;
      }
    }
    setHoverData(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '180px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverData(null)}
    >
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 2,
        }}
      >
        <span>MTF / SFR 调制传递函数曲线</span>
        <span style={{ color: '#38bdf8', fontSize: '10px' }}>● MTF (响应)</span>
        <span style={{ color: '#f87171', fontSize: '10px' }}>-- 50% 阈值线</span>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {hoverData && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(hoverData.x + 12, (containerRef.current?.clientWidth || 200) - 130)}px`,
            top: `${Math.max(10, hoverData.y - 45)}px`,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--accent-color)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            color: '#f8fafc',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div>频 率: <strong>{hoverData.freq.toFixed(3)}</strong> c/p</div>
          <div>MTF : <strong>{(hoverData.mtf * 100).toFixed(1)}%</strong></div>
        </div>
      )}
    </div>
  );
};
