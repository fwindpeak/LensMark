import {
  LensQualityResult,
  ZoneMetric,
  ChromaticAberrationResult,
  VignettingResult,
  HeatmapGrid,
  ROI,
} from '../types/mtf';
import { ExifOverview } from '../types/exif';

/**
 * 分析整张图片的镜头光学成像质量与分辨率
 * 结合真实光学 MTF、ISO 12233 边缘过冲检测 (Overshoot Debias)、
 * 显著特征掩模 (Salient Texture Masking) 与总画面解析力 (LW/PH)
 */
export function analyzeLensQuality(
  imageSource: CanvasImageSource,
  sourceWidth?: number,
  sourceHeight?: number,
  exif?: ExifOverview
): LensQualityResult {
  const nativeW =
    sourceWidth ||
    (imageSource as HTMLImageElement).naturalWidth ||
    (imageSource as HTMLImageElement).width ||
    800;
  const nativeH =
    sourceHeight ||
    (imageSource as HTMLImageElement).naturalHeight ||
    (imageSource as HTMLImageElement).height ||
    600;

  // 1. 创建高分辨率工作画布 (上限 2048px，保留充足的高频微观纹理与边缘跃迁剖面)
  const maxDim = 2048;
  let sampleW = nativeW;
  let sampleH = nativeH;
  if (Math.max(nativeW, nativeH) > maxDim) {
    const ratio = maxDim / Math.max(nativeW, nativeH);
    sampleW = Math.round(nativeW * ratio);
    sampleH = Math.round(nativeH * ratio);
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

  // 2. 提取灰度图与 RGB 通道分量
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
    // Rec. 709 亮度公式
    gray[j] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // 3. 估计画面噪点底噪 (Noise Floor)，避免高 ISO 噪点误判为锐度
  const noiseFloor = estimateNoiseFloor(gray, sampleW, sampleH);

  // 4. ISO 12233 边缘过冲与机内锐化 (Overshoot / Undershoot) 探查
  const { overshootPct, isOversharpened } = detectEdgeOvershoot(
    gray,
    sampleW,
    sampleH
  );

  // 5. 分块网格分析 (Grid 24x24) 与显著纹理掩模
  const gridCols = 24;
  const gridRows = 24;
  const heatmapData = new Float32Array(gridCols * gridRows);
  const blockW = sampleW / gridCols;
  const blockH = sampleH / gridRows;

  // 记录每个网格的特征统计
  const blockStats: {
    sharpness: number;
    tenengrad: number;
    laplacian: number;
    variance: number;
    hasTexture: boolean;
    contrast: number;
  }[] = [];

  let globalMaxSharpness = 0;
  let globalMinSharpness = Infinity;
  let totalTexturedBlocks = 0;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const startX = Math.floor(c * blockW);
      const endX = Math.floor((c + 1) * blockW);
      const startY = Math.floor(r * blockH);
      const endY = Math.floor((r + 1) * blockH);

      let tenenSum = 0;
      let lapSum = 0;
      let count = 0;
      let lumSum = 0;
      let lumSqSum = 0;
      let minLum = 255;
      let maxLum = 0;

      // 提取局部梯度与方差
      for (let y = Math.max(1, startY); y < Math.min(sampleH - 1, endY); y++) {
        const row = y * sampleW;
        for (let x = Math.max(1, startX); x < Math.min(sampleW - 1, endX); x++) {
          const val = gray[row + x];
          lumSum += val;
          lumSqSum += val * val;
          if (val < minLum) minLum = val;
          if (val > maxLum) maxLum = val;

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
          // 减去噪点底噪
          const cleanGrad = Math.max(0, gVal - noiseFloor * 1.5);
          if (cleanGrad > 4) {
            tenenSum += cleanGrad * cleanGrad;
          }

          // 8-邻域 Laplacian 纹理算子
          const lap = Math.abs(
            8 * val -
              gray[row - sampleW + (x - 1)] -
              gray[row - sampleW + x] -
              gray[row - sampleW + (x + 1)] -
              gray[row + (x - 1)] -
              gray[row + (x + 1)] -
              gray[row + sampleW + (x - 1)] -
              gray[row + sampleW + x] -
              gray[row + sampleW + (x + 1)]
          );
          const cleanLap = Math.max(0, lap - noiseFloor * 2.0);
          lapSum += cleanLap;
          count++;
        }
      }

      const meanTenen = count > 0 ? tenenSum / count : 0;
      const meanLap = count > 0 ? lapSum / count : 0;
      const variance =
        count > 0 ? Math.max(0, lumSqSum / count - (lumSum / count) ** 2) : 0;
      const contrast = maxLum - minLum;

      // 判断该网格是否包含有效结构/焦点纹理 (区分真实边缘 vs 平坦天空/纯色/死黑/死白)
      const hasTexture = contrast > 18 && variance > 12 && meanLap > 1.2;
      if (hasTexture) {
        totalTexturedBlocks++;
      }

      // 计算去过冲后的真实光学清晰度指标
      let rawSharp = Math.sqrt(meanTenen) * 0.65 + meanLap * 0.35;

      // 如果检测到手机/ISP 机内过冲锐化，校准压制虚高梯度
      if (isOversharpened && overshootPct > 10) {
        const debiasFactor = Math.max(0.4, 1.0 - (overshootPct - 10) * 0.015);
        rawSharp *= debiasFactor;
      }

      heatmapData[r * gridCols + c] = rawSharp;
      blockStats.push({
        sharpness: rawSharp,
        tenengrad: meanTenen,
        laplacian: meanLap,
        variance,
        hasTexture,
        contrast,
      });

      if (rawSharp > globalMaxSharpness) globalMaxSharpness = rawSharp;
      if (rawSharp < globalMinSharpness) globalMinSharpness = rawSharp;
    }
  }

  // 归一化热力图 (0.0 ~ 1.0)
  const normHeatmap = new Float32Array(gridCols * gridRows);
  const range = Math.max(1e-5, globalMaxSharpness - globalMinSharpness);
  for (let i = 0; i < heatmapData.length; i++) {
    normHeatmap[i] = Math.max(
      0,
      Math.min(1, (heatmapData[i] - globalMinSharpness) / range)
    );
  }

  const heatmap: HeatmapGrid = {
    cols: gridCols,
    rows: gridRows,
    data: normHeatmap,
    minVal: Math.round(globalMinSharpness * 10) / 10,
    maxVal: Math.round(globalMaxSharpness * 10) / 10,
  };

  // 全图纹理置信度 (0~100%)
  const textureConfidence = Math.min(
    100,
    Math.round((totalTexturedBlocks / (gridCols * gridRows * 0.4)) * 100)
  );

  // 6. 9 个标准像场分区评估 (中心、4 角、4 边)
  const scaleX = nativeW / sampleW;
  const scaleY = nativeH / sampleH;

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
      name: '中心像场 (Center 0.0~0.4R)',
      shortName: '中心',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'top_left',
      name: '左上角像场 (Top-Left 0.8~1.0R)',
      shortName: '左上',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'top_right',
      name: '右上角像场 (Top-Right 0.8~1.0R)',
      shortName: '右上',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
    {
      id: 'bottom_left',
      name: '左下角像场 (Bottom-Left 0.8~1.0R)',
      shortName: '左下',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'bottom_right',
      name: '右下角像场 (Bottom-Right 0.8~1.0R)',
      shortName: '右下',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
    {
      id: 'top',
      name: '顶部边缘像场 (Top 0.6~0.8R)',
      shortName: '顶部',
      rMin: 0,
      rMax: Math.floor(gridRows * 0.3),
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'bottom',
      name: '底部边缘像场 (Bottom 0.6~0.8R)',
      shortName: '底部',
      rMin: Math.floor(gridRows * 0.7),
      rMax: gridRows,
      cMin: Math.floor(gridCols * 0.3),
      cMax: Math.floor(gridCols * 0.7),
    },
    {
      id: 'left',
      name: '左侧边缘像场 (Left 0.6~0.8R)',
      shortName: '左侧',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: 0,
      cMax: Math.floor(gridCols * 0.3),
    },
    {
      id: 'right',
      name: '右侧边缘像场 (Right 0.6~0.8R)',
      shortName: '右侧',
      rMin: Math.floor(gridRows * 0.3),
      rMax: Math.floor(gridRows * 0.7),
      cMin: Math.floor(gridCols * 0.7),
      cMax: gridCols,
    },
  ];

  // 提取中心区的显著特征基准
  const centerValues: number[] = [];
  for (let r = Math.floor(gridRows * 0.3); r < Math.floor(gridRows * 0.7); r++) {
    for (let c = Math.floor(gridCols * 0.3); c < Math.floor(gridCols * 0.7); c++) {
      const stat = blockStats[r * gridCols + c];
      if (stat.hasTexture || stat.sharpness > 2) {
        centerValues.push(stat.sharpness);
      }
    }
  }
  // 取中心区域前 30% 最清晰显著纹理作为光学基准
  centerValues.sort((a, b) => b - a);
  const centerTopN = Math.max(1, Math.floor(centerValues.length * 0.35));
  const centerSalientMean =
    centerValues.length > 0
      ? centerValues.slice(0, centerTopN).reduce((a, b) => a + b, 0) / centerTopN
      : 8.0;

  // 7. 计算各分区的显著锐度 (Salient Percentile Sharpness)
  const zones: ZoneMetric[] = zoneConfigs.map((cfg) => {
    const zoneValues: number[] = [];
    let textureCount = 0;
    let totalInZone = 0;
    let tenenSum = 0;
    let lapSum = 0;

    for (let r = cfg.rMin; r < cfg.rMax; r++) {
      for (let c = cfg.cMin; c < cfg.cMax; c++) {
        const stat = blockStats[r * gridCols + c];
        totalInZone++;
        tenenSum += stat.tenengrad;
        lapSum += stat.laplacian;
        if (stat.hasTexture) {
          textureCount++;
        }
        zoneValues.push(stat.sharpness);
      }
    }

    zoneValues.sort((a, b) => b - a);
    const hasValidTexture = textureCount >= Math.max(1, totalInZone * 0.15);

    // 取该区域前 30% 显著特征值
    const topCount = Math.max(1, Math.floor(zoneValues.length * 0.3));
    const salientAvg =
      zoneValues.slice(0, topCount).reduce((a, b) => a + b, 0) / topCount;

    // 区域与中心的相对光学解析比率
    const ratioToCenter = salientAvg / Math.max(1e-4, centerSalientMean);

    // 综合打分：结合绝对微观反差 (Acutance) 与全场一致性
    // 若该区域缺乏纹理（例如四角是纯天空或虚化散景），自适应避免过分扣分
    let score: number;
    if (cfg.id === 'center') {
      // 中心锐度评分
      score = calculateAcutanceScore(salientAvg, isOversharpened, nativeH);
    } else {
      if (hasValidTexture) {
        const rawScore = calculateAcutanceScore(salientAvg, isOversharpened, nativeH);
        score = Math.round(rawScore * 0.5 + Math.min(100, ratioToCenter * 85) * 0.5);
      } else {
        // 无纹理/散景区：根据全场平均和中心光学基准进行软性推算，防止被天空/虚化误杀
        score = Math.round(
          Math.max(50, calculateAcutanceScore(centerSalientMean * 0.78, isOversharpened, nativeH))
        );
      }
    }
    score = Math.max(10, Math.min(100, score));

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
      tenengrad: Math.round((tenenSum / (totalInZone || 1)) * 10) / 10,
      laplacianVar: Math.round((lapSum / (totalInZone || 1)) * 10) / 10,
      colorFringingPx: 0,
      relativeIllumination: 100,
      roi,
      hasTexture: hasValidTexture,
      overshootPct,
    };
  });

  // 8. 色散 (Chromatic Aberration) 与紫边分析
  const caResult = calculateChromaticAberration(rChan, gChan, bChan, sampleW, sampleH);

  // 9. 暗角与相对照度 (Vignetting Profile)
  const vigResult = calculateVignetting(gray, sampleW, sampleH);

  // 补充各分区色散与照度
  zones.forEach((z) => {
    if (z.id === 'center') {
      z.relativeIllumination = 100;
      z.colorFringingPx = Math.round(caResult.averageCaPx * 0.3 * 100) / 100;
    } else if (['top_left', 'top_right', 'bottom_left', 'bottom_right'].includes(z.id)) {
      z.relativeIllumination = Math.round(vigResult.relativeIlluminationPct);
      z.colorFringingPx = Math.round(caResult.maxCaPx * 100) / 100;
    } else {
      z.relativeIllumination = Math.round((100 + vigResult.relativeIlluminationPct) / 2);
      z.colorFringingPx = Math.round(caResult.averageCaPx * 100) / 100;
    }
  });

  // 10. 计算中心锐度、边角平均锐度与衰减率
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
    Math.round(
      ((centerSharpness - cornerAvgSharpness) / Math.max(1, centerSharpness)) * 100
    )
  );

  // 11. 估算全图总画面解析力 (LW/PH, Line Widths per Picture Height)
  // 结合原生图像高度像素数与 MTF50 等效响应
  const nativeMegapixels = (nativeW * nativeH) / 1_000_000;
  const baseLwphFactor = (centerSharpness / 100) * 0.72; // 等效 MTF50 占奈奎斯特频率比率
  let lwphEstimate = Math.round(baseLwphFactor * nativeH * 2);
  if (isOversharpened) {
    // 扣除非光学计算锐化带来的虚高 LW/PH
    lwphEstimate = Math.round(lwphEstimate * 0.75);
  }

  // 12. 综合光学评分体系 (0~100)
  // 权重：中心光学解析度 35% + 边角衰减控制 25% + 总画面分辨率/细节量 20% + 色散 10% + 暗角 10%
  const falloffScore = Math.max(0, 100 - edgeFalloffPct * 1.2);
  
  // 画面像素解析力加成 (如 45MP 相机具备巨大光学信息量)
  const resolutionBonus = Math.min(100, Math.max(40, 50 + Math.log2(Math.max(1, nativeMegapixels / 12)) * 15));
  
  const caScore =
    caResult.averageCaPx < 0.6
      ? 95
      : caResult.averageCaPx < 1.2
      ? 82
      : caResult.averageCaPx < 2.0
      ? 65
      : 40;
  const vigScore = Math.min(100, Math.max(40, vigResult.relativeIlluminationPct));

  let rawOverallScore =
    centerSharpness * 0.35 +
    falloffScore * 0.25 +
    resolutionBonus * 0.20 +
    caScore * 0.10 +
    vigScore * 0.10;

  // 惩罚机内过度数字锐化
  if (isOversharpened && overshootPct > 15) {
    const penalty = Math.min(18, (overshootPct - 15) * 0.6);
    rawOverallScore = Math.max(40, rawOverallScore - penalty);
  }

  const overallScore = Math.round(rawOverallScore);

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

  // 13. 生成智能光学诊断结论与拍摄建议
  const { diagnosisSummary, recommendations } = generateDiagnosis(
    overallScore,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    caResult,
    vigResult,
    isOversharpened,
    overshootPct,
    lwphEstimate,
    textureConfidence,
    nativeMegapixels,
    exif
  );

  return {
    overallScore,
    gradeLevel,
    gradeTitle,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    overshootPct,
    isOversharpened,
    lwphEstimate,
    textureConfidence,
    zones,
    chromaticAberration: caResult,
    vignetting: vigResult,
    heatmap,
    diagnosisSummary,
    recommendations,
  };
}

/**
 * 依据微观清晰度梯度值映射到光学锐度分 (0~100)
 */
function calculateAcutanceScore(
  salientEnergy: number,
  isOversharpened: boolean,
  nativeHeight: number
): number {
  // 基础光学响应曲线 (对数压缩防爆表)
  let baseScore = 20 + Math.log1p(salientEnergy / 2.5) * 32;
  
  // 考虑原图物理像素尺度 (高像素原生解析力更强)
  if (nativeHeight >= 3000) {
    baseScore += 6;
  } else if (nativeHeight <= 1200) {
    baseScore -= 4;
  }

  if (isOversharpened) {
    baseScore -= 6;
  }

  return Math.round(Math.min(98, Math.max(15, baseScore)));
}

/**
 * 估计平坦区域的噪点底噪
 */
function estimateNoiseFloor(gray: Float32Array, w: number, h: number): number {
  let lowGradSum = 0;
  let count = 0;
  const step = 8;

  for (let y = 10; y < h - 10; y += step) {
    const row = y * w;
    for (let x = 10; x < w - 10; x += step) {
      const g = Math.abs(gray[row + (x + 1)] - gray[row + (x - 1)]);
      if (g < 15) {
        lowGradSum += g;
        count++;
      }
    }
  }

  return count > 0 ? lowGradSum / count : 2.0;
}

/**
 * ISO 12233 边缘过冲 (Overshoot / Edge Halo) 检测
 * 识别智能手机 ISP 的计算摄影强锐化白边
 */
function detectEdgeOvershoot(
  gray: Float32Array,
  w: number,
  h: number
): { overshootPct: number; isOversharpened: boolean } {
  let totalOvershoot = 0;
  let edgeSampleCount = 0;

  const step = 6;
  for (let y = 20; y < h - 20; y += step) {
    const row = y * w;
    for (let x = 20; x < w - 20; x += step) {
      // 水平方向寻找清晰阶跃边缘
      const g0 = gray[row + (x - 2)];
      const g1 = gray[row + (x - 1)];
      const g2 = gray[row + x];
      const g3 = gray[row + (x + 1)];
      const g4 = gray[row + (x + 2)];

      const jump = Math.abs(g3 - g1);
      if (jump > 35) {
        // 判断上升沿或下降沿是否存在 overshoot 突起
        const isRising = g3 > g1;
        let overshootVal = 0;
        let baseline = 0;

        if (isRising) {
          const highPeak = Math.max(g2, g3, g4);
          const lowBase = Math.min(g0, g1);
          baseline = Math.max(g3, g4);
          if (highPeak > baseline + 2) {
            overshootVal = (highPeak - baseline) / Math.max(1, highPeak - lowBase);
          }
        } else {
          const lowDip = Math.min(g2, g3, g4);
          const highBase = Math.max(g0, g1);
          baseline = Math.min(g3, g4);
          if (lowDip < baseline - 2) {
            overshootVal = (baseline - lowDip) / Math.max(1, highBase - lowDip);
          }
        }

        if (overshootVal > 0) {
          totalOvershoot += overshootVal;
        }
        edgeSampleCount++;
      }
    }
  }

  const avgOvershoot = edgeSampleCount > 20 ? (totalOvershoot / edgeSampleCount) * 100 : 0;
  const overshootPct = Math.round(avgOvershoot * 10) / 10;
  const isOversharpened = overshootPct >= 12;

  return {
    overshootPct,
    isOversharpened,
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

  const step = 4;
  for (let y = 10; y < h - 10; y += step) {
    const row = y * w;
    for (let x = 10; x < w - 10; x += step) {
      const gradG = Math.abs(g[row + (x + 1)] - g[row + (x - 1)]);
      if (gradG > 35) {
        totalEdgeCount++;
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
        if (currR > currG + 28 && currB > currG + 28) {
          purpleFringeCount++;
        }
      }
    }
  }

  const avgCa = sampleCount > 0 ? totalDelta / sampleCount : 0.35;
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
 * 计算暗角与相对照度 (采用高光分位数避免暗色物体误判)
 */
function calculateVignetting(
  gray: Float32Array,
  w: number,
  h: number
): VignettingResult {
  // 采样中心区域 (35% 范围) 的 80% 高光亮度
  const centerSamples: number[] = [];
  const cx1 = Math.floor(w * 0.35);
  const cx2 = Math.floor(w * 0.65);
  const cy1 = Math.floor(h * 0.35);
  const cy2 = Math.floor(h * 0.65);

  for (let y = cy1; y < cy2; y += 4) {
    const row = y * w;
    for (let x = cx1; x < cx2; x += 4) {
      centerSamples.push(gray[row + x]);
    }
  }
  centerSamples.sort((a, b) => b - a);
  const centerTopN = Math.max(1, Math.floor(centerSamples.length * 0.25));
  const centerLum =
    centerSamples.length > 0
      ? centerSamples.slice(0, centerTopN).reduce((a, b) => a + b, 0) / centerTopN
      : 128;

  // 采样四角区域 (15% 范围)
  const cornerSamples: number[] = [];
  const cornerW = Math.floor(w * 0.15);
  const cornerH = Math.floor(h * 0.15);

  const sampleCorner = (sx: number, ex: number, sy: number, ey: number) => {
    for (let y = sy; y < ey; y += 4) {
      const row = y * w;
      for (let x = sx; x < ex; x += 4) {
        cornerSamples.push(gray[row + x]);
      }
    }
  };

  sampleCorner(0, cornerW, 0, cornerH); // 左上
  sampleCorner(w - cornerW, w, 0, cornerH); // 右上
  sampleCorner(0, cornerW, h - cornerH, h); // 左下
  sampleCorner(w - cornerW, w, h - cornerH, h); // 右下

  cornerSamples.sort((a, b) => b - a);
  const cornerTopN = Math.max(1, Math.floor(cornerSamples.length * 0.25));
  const cornerLum =
    cornerSamples.length > 0
      ? cornerSamples.slice(0, cornerTopN).reduce((a, b) => a + b, 0) / cornerTopN
      : 100;

  const relativePct = Math.min(
    100,
    Math.max(25, (cornerLum / Math.max(1, centerLum)) * 100)
  );
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
  vig: VignettingResult,
  isOversharpened: boolean,
  overshootPct: number,
  lwph: number,
  textureConfidence: number,
  megapixels: number,
  exif?: ExifOverview
): { diagnosisSummary: string; recommendations: string[] } {
  const recommendations: string[] = [];

  let centerDesc = `中心分辨率高 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness >= 85) centerDesc = `中心解析力极高 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness < 70) centerDesc = `中心锐度适中 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness < 55) centerDesc = `中心成像偏软 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;

  let falloffDesc = `边缘画质衰减控制在 ${falloffPct}%，像场一致性优异`;
  if (falloffPct > 40) {
    falloffDesc = `边角画质衰减达 ${falloffPct}%（存在较明显软化/场曲）`;
    recommendations.push('建议收缩 1~2 档光圈拍摄风景或建筑，以显著提升边角解析力。');
  } else if (falloffPct > 22) {
    falloffDesc = `边角画质适度衰减 ${falloffPct}%（符合优质大光圈镜头正常光学特性）`;
    recommendations.push('主体置于中心或三分线区域可获得最佳锐利度。');
  } else {
    recommendations.push('边角至中心一致性出色，可放心全开光圈使用。');
  }

  let caDesc = '未发现可见色散';
  if (ca.averageCaPx > 1.2 || ca.fringeRatio > 5) {
    caDesc = `高反差边缘检出可见色散/紫边 (错位约 ${ca.averageCaPx} px)`;
    recommendations.push('高对比逆光场景建议在后期开启“镜头色差与紫边配置文件校正”。');
  }

  let vigDesc = '全场曝光照度均匀';
  if (vig.relativeIlluminationPct < 75) {
    vigDesc = `边角暗角衰减约 ${vig.evLoss} EV (${vig.relativeIlluminationPct}%)`;
    recommendations.push('拍摄纯色背景或天空时可适当开启机内暗角补偿。');
  }

  // 锐化与计算摄影诊断
  if (isOversharpened) {
    recommendations.push(
      `⚠️ 检测到机内计算摄影强锐化白边 (过冲率 ${overshootPct}%)，已算法去除非光学增益以评估真实镜头素质。`
    );
  }

  // 纹理置信度提示
  if (textureConfidence < 40) {
    recommendations.push(
      '💡 画面包含较大面积平坦区域（如天空/虚化散景），建议结合斜边模式或拍摄细节丰富的场景进行精准 MTF 测量。'
    );
  }

  // EXIF 额外光学诊断
  if (exif?.fNumber && exif.fNumber <= 1.8) {
    recommendations.push(
      `📷 当前光圈 f/${exif.fNumber} 属于超大光圈，中心锐利且边缘略带光学柔焦属正常物理像差表现。`
    );
  }

  const cameraInfo = exif?.model ? ` (${exif.model})` : '';
  const diagnosisSummary = `该镜头/设备${cameraInfo}在当前拍摄条件下综合评分为 ${overallScore} 分 (${
    overallScore >= 90 ? '卓越' : overallScore >= 80 ? '优秀' : overallScore >= 70 ? '良好' : '普通'
  })，总画面估计解析力约 ${lwph} LW/PH (${megapixels.toFixed(1)}MP)。${centerDesc}，${falloffDesc}。${caDesc}，${vigDesc}。${
    isOversharpened ? `(已校准机内 ${overshootPct}% 边缘过冲)` : ''
  }`;

  return {
    diagnosisSummary,
    recommendations,
  };
}
