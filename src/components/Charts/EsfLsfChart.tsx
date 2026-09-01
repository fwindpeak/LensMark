import React, { useEffect, useRef } from 'react';
import { MTFResult } from '../../types/mtf';

interface EsfLsfChartProps {
  result: MTFResult | null;
}

export const EsfLsfChart: React.FC<EsfLsfChartProps> = ({ result }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      const padL = 24;
      const padR = 24;
      const padT = 24;
      const padB = 20;
      const plotW = Math.max(10, width - padL - padR);
      const plotH = Math.max(10, height - padT - padB);

      // 绘制背景参考网格
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let v = 0; v <= 1.0; v += 0.5) {
        const y = padT + plotH * (1 - v);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(width - padR, y);
        ctx.stroke();
      }

      if (!result || !result.isValid || !result.esf || result.esf.length === 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('等待有效边缘选区...', padL + plotW / 2, padT + plotH / 2);
        return;
      }

      const { esf, lsf } = result;

      // 1. 绘制 ESF (蓝色曲线)
      const esfMin = Math.min(...esf);
      const esfMax = Math.max(...esf);
      const esfRange = esfMax - esfMin || 1;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();

      for (let i = 0; i < esf.length; i++) {
        const x = padL + (i / (esf.length - 1)) * plotW;
        const normVal = (esf[i] - esfMin) / esfRange;
        const y = padT + (1 - normVal) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 2. 绘制 LSF (绿色脉冲曲线)
      if (lsf && lsf.length > 0) {
        const lsfMax = Math.max(...lsf) || 1;

        // LSF 区域填充
        const lsfGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        lsfGrad.addColorStop(0, 'rgba(74, 222, 128, 0.25)');
        lsfGrad.addColorStop(1, 'rgba(74, 222, 128, 0.0)');

        ctx.save();
        ctx.beginPath();
        let lsfFirstX = padL;
        let lsfLastX = padL;

        for (let i = 0; i < lsf.length; i++) {
          const x = padL + (i / (lsf.length - 1)) * plotW;
          const normLsf = lsf[i] / lsfMax;
          const y = padT + (1 - normLsf) * plotH;

          if (i === 0) {
            lsfFirstX = x;
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          lsfLastX = x;
        }

        ctx.lineTo(lsfLastX, padT + plotH);
        ctx.lineTo(lsfFirstX, padT + plotH);
        ctx.closePath();
        ctx.fillStyle = lsfGrad;
        ctx.fill();
        ctx.restore();

        // LSF 描边
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < lsf.length; i++) {
          const x = padL + (i / (lsf.length - 1)) * plotW;
          const normLsf = lsf[i] / lsfMax;
          const y = padT + (1 - normLsf) * plotH;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [result]);

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
          gap: '10px',
          zIndex: 2,
        }}
      >
        <span>空间域过渡曲线</span>
        <span style={{ color: '#38bdf8', fontSize: '10px' }}>● ESF 边缘过渡</span>
        <span style={{ color: '#4ade80', fontSize: '10px' }}>● LSF 线扩散 (加窗)</span>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
