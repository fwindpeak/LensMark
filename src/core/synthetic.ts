export function slantedEdgePixels(width = 400, height = 400, angleDeg = 5.7) {
  const data = new Uint8ClampedArray(width * height * 4);
  const angleRad = (angleDeg * Math.PI) / 180;
  const tanTheta = Math.tan(angleRad);
  const cx = width / 2;

  for (let y = 0; y < height; y++) {
    const edgeX = cx + (y - height / 2) * tanTheta;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dist = x - edgeX;
      // 平滑合成过渡，仅用于演示，不代表经标定的光学 PSF
      const val = 20 + 215 * (0.5 + 0.5 * Math.tanh(dist / 1.5));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

/**
 * 生成合成模拟斜边图像 (用于基准测试与默认状态展示)
 * 包含光学点扩散函数 (PSF) 模糊过渡
 */
export function generateSyntheticSlantedEdge(
  width = 400,
  height = 400,
  angleDeg = 5.7
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create 2d context for synthetic edge'));
      return;
    }

    const imgData = ctx.createImageData(width, height);
    imgData.data.set(slantedEdgePixels(width, height, angleDeg).data);
    ctx.putImageData(imgData, 0, 0);

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = canvas.toDataURL();
  });
}

/**
 * 生成完整的全图镜头测试标板合成图 (含中心与四角倾斜测试靶块、暗角与渐变纹理)
 */
export function generateSyntheticChart(
  width = 800,
  height = 600
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create 2d context for synthetic chart'));
      return;
    }

    // 1. 绘制中性灰背景与微弱暗角 (Vignetting)
    const bgGradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    bgGradient.addColorStop(0, '#f1f5f9');
    bgGradient.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. 绘制九宫格辅助线
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((2 * width) / 3, 0);
    ctx.lineTo((2 * width) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (2 * height) / 3);
    ctx.lineTo(width, (2 * height) / 3);
    ctx.stroke();

    // 3. 绘制带 5.7° 倾斜的黑白靶块 (Center + 4 Corners + 4 Edges)
    const drawSlantedTarget = (cx: number, cy: number, size: number, angleDeg: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((angleDeg * Math.PI) / 180);

      // 白色底框
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-size / 2 - 4, -size / 2 - 4, size + 8, size + 8);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2 - 4, -size / 2 - 4, size + 8, size + 8);

      // 左黑右白
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-size / 2, -size / 2, size / 2, size);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -size / 2, size / 2, size);

      ctx.restore();
    };

    const targetSize = 64;
    // 中心 (5.7° 斜边)
    drawSlantedTarget(width / 2, height / 2, targetSize * 1.2, 5.7);

    // 四角 (5.7° ~ 6.0°)
    drawSlantedTarget(width * 0.16, height * 0.2, targetSize, 5.7);
    drawSlantedTarget(width * 0.84, height * 0.2, targetSize, -5.7);
    drawSlantedTarget(width * 0.16, height * 0.8, targetSize, -5.7);
    drawSlantedTarget(width * 0.84, height * 0.8, targetSize, 5.7);

    // 上下左右中点
    drawSlantedTarget(width / 2, height * 0.16, targetSize * 0.9, 5.7);
    drawSlantedTarget(width / 2, height * 0.84, targetSize * 0.9, -5.7);
    drawSlantedTarget(width * 0.14, height / 2, targetSize * 0.9, 5.7);
    drawSlantedTarget(width * 0.86, height / 2, targetSize * 0.9, -5.7);

    // 4. 绘制同心圆与标定文字
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ISO 12233 MULTI-ZONE LENS TEST TARGET', width / 2, height / 2 + 70);

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = canvas.toDataURL();
  });
}
