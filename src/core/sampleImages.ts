/**
 * 预设样张生成器，供用户免上传一键体验各种镜头与场景的光学成像质量评估
 */

export interface SamplePreset {
  id: string;
  name: string;
  description: string;
  generator: () => Promise<HTMLImageElement>;
}

/**
 * 创建高分辨率 Canvas 并转为 Image
 */
function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL('image/png');
  });
}

/**
 * 样张 1: 模拟标准 ISO 12233 综合测试标板
 * 包含中心高解析斜边、四角斜边、星芒线、色散网格与渐变背景
 */
export async function generateSyntheticIsoChart(w = 1200, h = 800): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. 基础背景 (微弱四角暗角)
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.hypot(w / 2, h / 2));
  bgGrad.addColorStop(0, '#f8fafc');
  bgGrad.addColorStop(0.7, '#e2e8f0');
  bgGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. 网格辅助线
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 1;
  for (let x = 100; x < w; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 100; y < h; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // 3. 中心及各区域绘制 5.7° 倾斜黑白标靶
  const drawSlantedTarget = (cx: number, cy: number, size: number, angleDeg: number, blur = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    if (blur > 0) {
      ctx.filter = `blur(${blur}px)`;
    }

    // 绘制黑白对半切块
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-size / 2, -size / 2, size, size);

    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -size, size, size * 2);

    ctx.restore();
  };

  // 中心标靶 (高锐度, 0 blur)
  drawSlantedTarget(w / 2, h / 2, 140, 5.7, 0);
  drawSlantedTarget(w / 2 - 160, h / 2, 90, -5.7, 0.2);
  drawSlantedTarget(w / 2 + 160, h / 2, 90, 6.2, 0.2);

  // 4 个边角标靶 (轻微像差与软化 blur 0.8~1.2)
  drawSlantedTarget(160, 140, 110, 6.0, 0.9);
  drawSlantedTarget(w - 160, 140, 110, -5.5, 0.8);
  drawSlantedTarget(160, h - 140, 110, -6.2, 1.1);
  drawSlantedTarget(w - 160, h - 140, 110, 5.8, 1.0);

  // 4 个边缘标靶
  drawSlantedTarget(w / 2, 120, 90, 5.7, 0.5);
  drawSlantedTarget(w / 2, h - 120, 90, -5.7, 0.6);
  drawSlantedTarget(140, h / 2, 90, -5.7, 0.6);
  drawSlantedTarget(w - 140, h / 2, 90, 5.7, 0.5);

  // 4. 添加高反差几何同心圆与标线 (产生色散与纹理细节)
  ctx.save();
  ctx.translate(w / 2, h / 2);
  for (let r = 180; r < 240; r += 12) {
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 5. 边角添加轻微彩边 (Chromatic Aberration 模拟)
  ctx.fillStyle = 'rgba(236, 72, 153, 0.35)'; // 紫红色边
  ctx.fillRect(w - 220, 100, 4, 80);
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)'; // 青色边
  ctx.fillRect(w - 216, 100, 4, 80);

  return canvasToImage(canvas);
}

/**
 * 样张 2: 模拟大光圈定焦镜头 (F1.4) 拍摄场景
 * 特点：中心极锐，边角有适度像散软化、明显暗角与轻微紫边
 */
export async function generateSyntheticApertureScene(w = 1200, h = 800): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. 深色摄影室内环境
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, Math.hypot(w / 2, h / 2) * 0.9);
  bgGrad.addColorStop(0, '#2d3748');
  bgGrad.addColorStop(0.5, '#1a202c');
  bgGrad.addColorStop(1, '#080c14'); // 较强暗角
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. 主体中心区域丰富高频纹理 (人眼、手表、机械表盘模拟)
  ctx.save();
  ctx.translate(w / 2, h / 2);

  // 绘制精密表盘刻度
  for (let i = 0; i < 60; i++) {
    const angle = (i * 6 * Math.PI) / 180;
    ctx.strokeStyle = i % 5 === 0 ? '#f8fafc' : '#94a3b8';
    ctx.lineWidth = i % 5 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 120, Math.sin(angle) * 120);
    ctx.lineTo(Math.cos(angle) * (i % 5 === 0 ? 145 : 135), Math.sin(angle) * (i % 5 === 0 ? 145 : 135));
    ctx.stroke();
  }

  // 中心高对比文字与斜边结构
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CHRONOMETER', 0, -40);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('HIGH RESOLUTION F/1.4', 0, 45);

  // 高反差斜切指针 (产生天然倾斜高频边缘)
  ctx.save();
  ctx.rotate((68 * Math.PI) / 180); // 倾角
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, -6, 110, 12);
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(0, -2, 130, 4);
  ctx.restore();

  ctx.restore();

  // 3. 边角背景虚化散景 (Bokeh balls)
  const drawBokeh = (x: number, y: number, r: number, color: string) => {
    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  drawBokeh(120, 120, 45, 'rgba(244, 114, 182, 0.4)');
  drawBokeh(180, 200, 35, 'rgba(56, 189, 248, 0.35)');
  drawBokeh(w - 140, 150, 50, 'rgba(251, 191, 36, 0.4)');
  drawBokeh(w - 180, h - 160, 55, 'rgba(74, 222, 128, 0.35)');
  drawBokeh(150, h - 130, 40, 'rgba(168, 85, 247, 0.4)');

  // 4. 强高光边缘色散紫边 (模拟大光圈轴向/垂轴色差)
  ctx.save();
  ctx.strokeStyle = 'rgba(217, 70, 239, 0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2 + 100, h / 2 - 80, 60, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  return canvasToImage(canvas);
}

/**
 * 样张 3: 模拟超广角风光摄影 (16mm F8)
 * 特点：全场高锐度、边角轻微场曲、极佳色差控制
 */
export async function generateSyntheticLandscapeScene(w = 1200, h = 800): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. 天空渐变
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  skyGrad.addColorStop(0, '#0369a1');
  skyGrad.addColorStop(0.5, '#38bdf8');
  skyGrad.addColorStop(1, '#bae6fd');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h * 0.6);

  // 2. 远景山峦与建筑斜线 (高频细节)
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.lineTo(w * 0.25, h * 0.35);
  ctx.lineTo(w * 0.5, h * 0.48);
  ctx.lineTo(w * 0.75, h * 0.32);
  ctx.lineTo(w, h * 0.52);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // 3. 前景几何建筑物 (丰富斜边与高频窗格)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w * 0.15, h * 0.4, w * 0.7, h * 0.5);

  // 窗格网格
  ctx.fillStyle = '#f8fafc';
  for (let bx = w * 0.18; bx < w * 0.82; bx += 36) {
    for (let by = h * 0.45; by < h * 0.85; by += 28) {
      ctx.fillRect(bx, by, 22, 16);
    }
  }

  // 4. 地面铺装纹理
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h * 0.85, w, h * 0.15);

  return canvasToImage(canvas);
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'iso_chart',
    name: 'ISO 12233 标板样张',
    description: '标准测试靶标，包含中心/边角斜边与高频条纹',
    generator: () => generateSyntheticIsoChart(1200, 800),
  },
  {
    id: 'aperture_f14',
    name: 'F1.4 大光圈场景',
    description: '中心极锐利、边角适度虚化与轻微紫边',
    generator: () => generateSyntheticApertureScene(1200, 800),
  },
  {
    id: 'landscape_f8',
    name: 'F8 广角风光场景',
    description: '全场均衡高解析力、高反差几何边缘',
    generator: () => generateSyntheticLandscapeScene(1200, 800),
  },
];
