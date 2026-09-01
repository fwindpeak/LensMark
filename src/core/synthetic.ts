/**
 * 生成合成模拟斜边图像 (用于基准测试与默认状态展示)
 * 包含光学点扩散函数 (PSF) 模糊过渡与高斯微噪
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
    const data = imgData.data;
    const angleRad = (angleDeg * Math.PI) / 180;
    const tanTheta = Math.tan(angleRad);
    const cx = width / 2;

    for (let y = 0; y < height; y++) {
      const edgeX = cx + (y - height / 2) * tanTheta;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dist = x - edgeX;
        // 使用双曲正切模拟误差函数 (ERF) 光学边缘过渡 (点扩散 PSF 模糊)
        const val = 20 + 215 * (0.5 + 0.5 * Math.tanh(dist / 1.5));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = canvas.toDataURL();
  });
}
