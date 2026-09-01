import {
  LensQualityResult,
  ZoneMetric,
  ChromaticAberrationResult,
  VignettingResult,
  HeatmapGrid,
  ROI,
} from '../types/mtf';

/**
 * 分析整张图片的镜头光学成像质量
 * 无需标板，支持任意实拍照片（风景、人像、静物等）
 */
export function analyzeLensQuality(
  imageSource: CanvasImageSource,
  sourceWidth?: number,
  sourceHeight?: number
): LensQualityResult {
  const w =
    sourceWidth ||
    (imageSource as HTMLImageElement).naturalWidth ||
    (imageSource as HTMLImageElement).width ||
    800;
  const h =
    sourceHeight ||
    (imageSource as HTMLImageElement).naturalHeight ||
    (imageSource as HTMLImageElement).height ||
    600;

  // 1. 创建内存画布提取 ImageData（适度下采样至不超过 1600 宽以保证毫秒级实时响应）
  const maxDim = 1200;
  let sampleW = w;
  let sampleH = h;
  if (Math.max(w, h) > maxDim) {
    const ratio = maxDim / Math.max(w, h);
    sampleW = Math.round(w * ratio);
    sampleH = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context creation failed');
  }

  ctx.drawImage(imageSource, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // 2. 提取灰度图与 RGB 分量
  const gray = new Float32Array(sampleW * sampleH);
  const rChan = new Float32Array(sampleW * sampleH);
  const gChan = new Float32Array(sampleW * sampleH);
  const bChan = new Float32Array(sampleW * sampleH);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    rChan[j] = r;
    gChan[j] = g;
    bChan[j] = b;
    // sRGB -> 相对亮度
    gray[j] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // 3. 计算微块清晰度与全图热力图网格 (Grid 24x24)
  const gridCols = 24;
  const gridRows = 24;
  const heatmapData = new Float32Array(gridCols * gridRows);
  const blockW = sampleW / gridCols;
  const blockH = sampleH / gridRows;

  let globalMaxSharpness = 0;
  let globalMinSharpness = Infinity;

  // 统计各微块的 Tenengrad 梯度与 Laplacian 纹理方差
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const startX = Math.floor(c * blockW);
      const endX = Math.floor((c + 1) * blockW);
      const startY = Math.floor(r * blockH);
      const endY = Math.floor((r + 1) * blockH);

      let tenenSum = 0;
      let lapSum = 0;
      let count = 0;

      for (let y = Math.max(1, startY); y < Math.min(sampleH - 1, endY); y++) {
        const row = y * sampleW;
        for (let x = Math.max(1, startX); x < Math.min(sampleW - 1, endX); x++) {
          // Sobel 梯度
          const gx =
            gray[row - sampleW + (x + 1)] +
            2 * gray[row + (x + 1)] +
            gray[row + sampleW + (x + 1)] -
            (gray[row - sampleW + (x - 1)] +
              2 * gray[row + (x - 1)] +
              gray[row + sampleW + (x - 1)]);
          const gy =
            gray[row + sampleW + (x - 1)] +
            2 * gray[row + sampleW + x] +
            gray[row + sampleW + (x + 1)] -
            (gray[row - sampleW + (x - 1)] +
              2 * gray[row - sampleW + x] +
              gray[row - sampleW + (x + 1)]);

          const gVal = Math.sqrt(gx * gx + gy * gy);
          if (gVal > 6) {
            tenenSum += gVal * gVal;
          }

          // Laplacian 滤波器
          const lap =
            Math.abs(
              4 * gray[row + x] -
                gray[row - sampleW + x] -
                gray[row + sampleW + x] -
                gray[row + (x - 1)] -
                gray[row + (x + 1)]
            );
          lapSum += lap;
          count++;
        }
      }

      const meanTenen = count > 0 ? tenenSum / count : 0;
      const meanLap = count > 0 ? lapSum / count : 0;
      // 综合高频响应
      const blockSharpness = Math.sqrt(meanTenen) * 0.7 + meanLap * 0.3;
      heatmapData[r * gridCols + c] = blockSharpness;

      if (blockSharpness > globalMaxSharpness) globalMaxSharpness = blockSharpness;
      if (blockSharpness < globalMinSharpness) globalMinSharpness = blockSharpness;
    }
  }

  // 归一化热力图 (0.0 ~ 1.0)
  const normHeatmap = new Float32Array(gridCols * gridRows);
  const range = Math.max(1e-5, globalMaxSharpness - globalMinSharpness);
  for (let i = 0; i < heatmapData.length; i++) {
    normHeatmap[i] = Math.max(0, Math.min(1, (heatmapData[i] - globalMinSharpness) / range));
  }

  const heatmap: HeatmapGrid = {
    cols: gridCols,
    rows: gridRows,
    data: normHeatmap,
    minVal: globalMinSharpness,
    maxVal: globalMaxSharpness,
  };

  // 4. 计算 9 个标准光学分区指标 (中心、4角、4边)
  const scaleX = w / sampleW;
  const scaleY = h / sampleH;

  const zoneConfigs: {
    id: ZoneMetric['id'];
    name: string;
    shortName: string;
    rMin: number;
    rMax: number;
    cMin: number;
    cMax: number;
  }[] = [
    {
      id: 'center',
      name: '中心像场 (Center)',
      shortName: '中心',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'top_left',
      name: '左上角像场 (Top-Left)',
      shortName: '左上',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'top_right',
      name: '右上角像场 (Top-Right)',
      shortName: '右上',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
    {
      id: 'bottom_left',
      name: '左下角像场 (Bottom-Left)',
      shortName: '左下',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'bottom_right',
      name: '右下角像场 (Bottom-Right)',
      shortName: '右下',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
    {
      id: 'top',
      name: '顶部边缘像场 (Top)',
      shortName: '顶部',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'bottom',
      name: '底部边缘像场 (Bottom)',
      shortName: '底部',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'left',
      name: '左侧边缘像场 (Left)',
      shortName: '左侧',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'right',
      name: '右侧边缘像场 (Right)',
      shortName: '右侧',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
  ];

  // 计算中心区基础能量
  let centerRawEnergy = 0;
  let centerCount = 0;
  for (let r = Math.floor(gridRows * 0.35); r < Math.floor(gridRows * 0.65); r++) {
    for (let c = Math.floor(gridCols * 0.35); c < Math.floor(gridCols * 0.65); c++) {
      centerRawEnergy += heatmapData[r * gridCols + c];
      centerCount++;
    }
  }
  const centerBase = Math.max(1, centerRawEnergy / (centerCount || 1));

  const zones: ZoneMetric[] = zoneConfigs.map((cfg) => {
    let sumRaw = 0;
    let bCount = 0;
    for (let r = cfg.rMin; r < cfg.rMax; r++) {
      for (let c = cfg.cMin; c < cfg.cMax; c++) {
        sumRaw += heatmapData[r * gridCols + c];
        bCount++;
      }
    }
    const avgRaw = sumRaw / (bCount || 1);

    // 将原始能量映射至 0~100 分数
    // 以中心基准为参照，加上自身绝对高频响应
    const relativeRatio = avgRaw / centerBase;
    let score = Math.round(Math.min(100, Math.max(10, (avgRaw / 25) * 85 + relativeRatio * 15)));

    // 区域对应的原图 ROI
    const roi: ROI = {
      x: Math.round(cfg.cMin * blockW * scaleX),
      y: Math.round(cfg.rMin * blockH * scaleY),
      w: Math.round((cfg.cMax - cfg.cMin) * blockW * scaleX),
      h: Math.round((cfg.rMax - cfg.rMin) * blockH * scaleY),
    };

    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      sharpness: score,
      tenengrad: Math.round(avgRaw * 10) / 10,
      laplacianVar: Math.round(avgRaw * 5) / 10,
      colorFringingPx: 0,
      relativeIllumination: 100,
      roi,
    };
  });

  // 5. 色散 (Chromatic Aberration) 与紫边分析
  const caResult = calculateChromaticAberration(rChan, gChan, bChan, sampleW, sampleH);

  // 6. 暗角与相对照度 (Vignetting Profile)
  const vigResult = calculateVignetting(gray, sampleW, sampleH);

  // 为各分区补充色散与照度估值
  zones.forEach((z) => {
    if (z.id === 'center') {
      z.relativeIllumination = 100;
      z.colorFringingPx = Math.round(caResult.averageCaPx * 0.4 * 100) / 100;
    } else if (['top_left', 'top_right', 'bottom_left', 'bottom_right'].includes(z.id)) {
      z.relativeIllumination = Math.round(vigResult.relativeIlluminationPct);
      z.colorFringingPx = Math.round(caResult.maxCaPx * 100) / 100;
    } else {
      z.relativeIllumination = Math.round((100 + vigResult.relativeIlluminationPct) / 2);
      z.colorFringingPx = Math.round(caResult.averageCaPx * 100) / 100;
    }
  });

  // 7. 计算中心锐度、边角平均锐度与衰减率
  const centerZone = zones.find((z) => z.id === 'center')!;
  const cornerZones = zones.filter((z) =>
    ['top_left', 'top_right', 'bottom_left', 'bottom_right'].includes(z.id)
  );
  const cornerAvgSharpness = Math.round(
    cornerZones.reduce((acc, curr) => acc + curr.sharpness, 0) / cornerZones.length
  );
  const centerSharpness = centerZone.sharpness;

  const edgeFalloffPct = Math.max(
    0,
    Math.round(((centerSharpness - cornerAvgSharpness) / Math.max(1, centerSharpness)) * 100)
  );

  // 8. 计算综合评分 (0~100) 与评级
  // 权重：中心锐度 40% + 边角衰减控制 30% + 色散表现 15% + 暗角照度 15%
  const falloffScore = Math.max(0, 100 - edgeFalloffPct * 1.5);
  const caScore =
    caResult.averageCaPx < 0.6 ? 95 : caResult.averageCaPx < 1.2 ? 80 : caResult.averageCaPx < 2.0 ? 65 : 45;
  const vigScore = Math.min(100, Math.max(40, vigResult.relativeIlluminationPct));

  const overallScore = Math.round(
    centerSharpness * 0.4 + falloffScore * 0.3 + caScore * 0.15 + vigScore * 0.15
  );

  let gradeLevel: LensQualityResult['gradeLevel'] = 'B';
  let gradeTitle = '良好 (成像均衡)';
  if (overallScore >= 90) {
    gradeLevel = 'S';
    gradeTitle = '卓越 (旗舰级光学素质)';
  } else if (overallScore >= 80) {
    gradeLevel = 'A';
    gradeTitle = '优秀 (高分辨率锐利)';
  } else if (overallScore >= 70) {
    gradeLevel = 'B';
    gradeTitle = '良好 (主流均衡)';
  } else if (overallScore >= 60) {
    gradeLevel = 'C';
    gradeTitle = '普通 (边缘软化/存在色散)';
  } else {
    gradeLevel = 'D';
    gradeTitle = '偏软 (解析力较低)';
  }

  // 9. 生成智能光学诊断结论与拍摄建议
  const { diagnosisSummary, recommendations } = generateDiagnosis(
    overallScore,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    caResult,
    vigResult
  );

  return {
    overallScore,
    gradeLevel,
    gradeTitle,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    zones,
    chromaticAberration: caResult,
    vignetting: vigResult,
    heatmap,
    diagnosisSummary,
    recommendations,
  };
}

/**
 * 计算色散 (CA) 与紫边
 */
function calculateChromaticAberration(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  w: number,
  h: number
): ChromaticAberrationResult {
  let totalDelta = 0;
  let maxDelta = 0;
  let sampleCount = 0;
  let purpleFringeCount = 0;
  let totalEdgeCount = 0;

  // 沿边缘采样 R/G/B 通道子像素错位
  const step = 4;
  for (let y = 10; y < h - 10; y += step) {
    const row = y * w;
    for (let x = 10; x < w - 10; x += step) {
      // 检查是否为高反差边缘
      const gradG = Math.abs(g[row + (x + 1)] - g[row + (x - 1)]);
      if (gradG > 40) {
        totalEdgeCount++;
        // 估算 R-G 与 B-G 的质心偏移
        const dr = (r[row + (x + 1)] - r[row + (x - 1)]) / 2;
        const dg = (g[row + (x + 1)] - g[row + (x - 1)]) / 2;
        const db = (b[row + (x + 1)] - b[row + (x - 1)]) / 2;

        const shiftRB = Math.abs(dr - db) / (Math.abs(dg) + 1e-4);
        const shiftPx = Math.min(4.0, shiftRB);

        totalDelta += shiftPx;
        if (shiftPx > maxDelta) maxDelta = shiftPx;
        sampleCount++;

        // 检测紫边 (R & B 明显高于 G)
        const currR = r[row + x];
        const currG = g[row + x];
        const currB = b[row + x];
        if (currR > currG + 30 && currB > currG + 30) {
          purpleFringeCount++;
        }
      }
    }
  }

  const avgCa = sampleCount > 0 ? totalDelta / sampleCount : 0.4;
  const fringeRatio = totalEdgeCount > 0 ? (purpleFringeCount / totalEdgeCount) * 100 : 0;

  let grade: ChromaticAberrationResult['grade'] = '极佳 (无明显色散)';
  if (avgCa > 1.8 || fringeRatio > 8) {
    grade = '较重 (明显色边)';
  } else if (avgCa > 1.1 || fringeRatio > 3) {
    grade = '中等 (可见紫边)';
  } else if (avgCa > 0.6) {
    grade = '良好 (轻微色散)';
  }

  return {
    averageCaPx: Math.round(avgCa * 100) / 100,
    maxCaPx: Math.round(Math.min(5, maxDelta) * 100) / 100,
    fringeRatio: Math.round(fringeRatio * 10) / 10,
    grade,
  };
}

/**
 * 计算暗角与相对照度
 */
function calculateVignetting(
  gray: Float32Array,
  w: number,
  h: number
): VignettingResult {
  // 中心区域 (30% 范围)
  let centerLumSum = 0;
  let centerCount = 0;
  const cx1 = Math.floor(w * 0.35);
  const cx2 = Math.floor(w * 0.65);
  const cy1 = Math.floor(h * 0.35);
  const cy2 = Math.floor(h * 0.65);

  for (let y = cy1; y < cy2; y += 4) {
    const row = y * w;
    for (let x = cx1; x < cx2; x += 4) {
      centerLumSum += gray[row + x];
      centerCount++;
    }
  }
  const centerLum = centerCount > 0 ? centerLumSum / centerCount : 128;

  // 四角区域 (15% 范围)
  let cornerLumSum = 0;
  let cornerCount = 0;
  const cornerW = Math.floor(w * 0.15);
  const cornerH = Math.floor(h * 0.15);

  const sampleCorner = (sx: number, ex: number, sy: number, ey: number) => {
    for (let y = sy; y < ey; y += 4) {
      const row = y * w;
      for (let x = sx; x < ex; x += 4) {
        cornerLumSum += gray[row + x];
        cornerCount++;
      }
    }
  };

  sampleCorner(0, cornerW, 0, cornerH); // 左上
  sampleCorner(w - cornerW, w, 0, cornerH); // 右上
  sampleCorner(0, cornerW, h - cornerH, h); // 左下
  sampleCorner(w - cornerW, w, h - cornerH, h); // 右下

  const cornerLum = cornerCount > 0 ? cornerLumSum / cornerCount : 100;
  const relativePct = Math.min(100, Math.max(20, (cornerLum / Math.max(1, centerLum)) * 100));
  const evLoss = Math.round(Math.log2(Math.max(0.1, relativePct / 100)) * 10) / 10;

  let grade: VignettingResult['grade'] = '均匀';
  if (relativePct < 55) {
    grade = '显著暗角';
  } else if (relativePct < 72) {
    grade = '中等暗角';
  } else if (relativePct < 88) {
    grade = '轻微暗角';
  }

  return {
    centerLuminance: Math.round(centerLum),
    cornerLuminance: Math.round(cornerLum),
    relativeIlluminationPct: Math.round(relativePct),
    evLoss: Math.abs(evLoss),
    grade,
  };
}

/**
 * 自动生成光学诊断结论与使用建议
 */
function generateDiagnosis(
  overallScore: number,
  centerSharpness: number,
  cornerAvgSharpness: number,
  falloffPct: number,
  ca: ChromaticAberrationResult,
  vig: VignettingResult
): { diagnosisSummary: string; recommendations: string[] } {
  const recommendations: string[] = [];

  let centerDesc = `中心分辨率极高 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness < 70) centerDesc = `中心锐度一般 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness < 55) centerDesc = `中心成像偏软 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;

  let falloffDesc = `边缘画质衰减控制在 ${falloffPct}%，表现优异`;
  if (falloffPct > 40) {
    falloffDesc = `边角画质衰减达到 ${falloffPct}%，存在较明显软化与场曲`;
    recommendations.push('建议收缩 1~2 档光圈拍摄风景或建筑，以显著提升边角解析力。');
  } else if (falloffPct > 25) {
    falloffDesc = `边角画质适度衰减 ${falloffPct}%（符合常规大光圈镜头光学特性）`;
    recommendations.push('主体置于中心或三分线区域可获得最佳锐利度。');
  } else {
    recommendations.push('全开光圈即可放心使用，边角至中心一致性极佳。');
  }

  let caDesc = '未发现可见色散';
  if (ca.averageCaPx > 1.2 || ca.fringeRatio > 5) {
    caDesc = `高反差边缘检出可见色散与紫边 (错位约 ${ca.averageCaPx} px)`;
    recommendations.push('在逆光或高对比边缘场景建议在后期开启“镜头配置文件色差消除”。');
  }

  let vigDesc = '全场曝光均匀';
  if (vig.relativeIlluminationPct < 75) {
    vigDesc = `边角暗角衰减约 ${vig.evLoss} EV (${vig.relativeIlluminationPct}%)`;
    recommendations.push('拍摄纯色背景或平坦天空时可适当启用机内暗角补偿。');
  }

  const diagnosisSummary = `该镜头在当前拍摄条件下综合评分为 ${overallScore} 分 (${
    overallScore >= 85 ? '卓越' : overallScore >= 75 ? '优秀' : '标准'
  })。${centerDesc}，${falloffDesc}。${caDesc}，${vigDesc}。`;

  return {
    diagnosisSummary,
    recommendations,
  };
}
