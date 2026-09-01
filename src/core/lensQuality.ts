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
 * 结合真实光学结构相干性 (Structure Tensor Coherence)、
 * MAD 稳健噪声与信噪比 (SNR) 估计、JPEG 8x8 块效应/马赛克检测、
 * 物理分辨率硬性上限标定与 ISO 12233 边缘去过冲 (Overshoot Debias)
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

  // 1. 创建高分辨率工作画布 (上限 2048px，保留充足的高频微观纹理与边缘剖面)
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

  let meanLuminance = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    rChan[j] = r;
    gChan[j] = g;
    bChan[j] = b;
    // Rec. 709 亮度公式
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    gray[j] = lum;
    meanLuminance += lum;
  }
  meanLuminance /= Math.max(1, sampleW * sampleH);

  // 3. 稳健估算噪声底噪 (MAD Robust Noise Estimation) 与信噪比 (SNR dB)
  const { noiseSigma, snrDb, noiseLevel } = estimateNoiseAndSnr(
    gray,
    sampleW,
    sampleH,
    meanLuminance
  );

  // 4. JPEG 8x8 块效应与马赛克伪影强度检测 (Blockiness)
  const blockinessPct = detectJpegBlockiness(gray, sampleW, sampleH);

  // 5. ISO 12233 边缘过冲与机内锐化 (Overshoot / Undershoot) 探查
  const { overshootPct, isOversharpened } = detectEdgeOvershoot(
    gray,
    sampleW,
    sampleH
  );

  // 6. 原生物理分辨率与信息承载力判定
  const nativeMegapixels = (nativeW * nativeH) / 1_000_000;
  const isResolutionLimited = nativeMegapixels < 2.5 || Math.min(nativeW, nativeH) < 1000;

  // 根据物理像素数确定清晰度天花板 (杜绝 30万像素老手机得到高分)
  let maxResolutionCap = 100;
  if (nativeMegapixels < 0.6) {
    maxResolutionCap = 48; // 极低清/老旧功能机 (如 640x480) 封顶 D 级
  } else if (nativeMegapixels < 1.2) {
    maxResolutionCap = 58; // 低清缩略图/老手机 (如 1024x768) 封顶 D 级~低 C 级
  } else if (nativeMegapixels < 2.5) {
    maxResolutionCap = 72; // 早期 200万像素手机 封顶 B 级以下
  } else if (nativeMegapixels < 5.0) {
    maxResolutionCap = 84; // 主流 500万像素 封顶 A 级以下
  }

  // 7. 分块网格分析 (Grid 24x24) 与结构张量相干性加权
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

  // 预先计算 Sobel 梯度与结构张量相干性，彻底过滤随机高频白噪声
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const startX = Math.floor(c * blockW);
      const endX = Math.floor((c + 1) * blockW);
      const startY = Math.floor(r * blockH);
      const endY = Math.floor((r + 1) * blockH);

      let coherentGradSum = 0;
      let rawTenenSum = 0;
      let lapSum = 0;
      let count = 0;
      let lumSum = 0;
      let lumSqSum = 0;
      let minLum = 255;
      let maxLum = 0;

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

          const gMag = Math.sqrt(gx * gx + gy * gy);
          rawTenenSum += gMag * gMag;

          // 结构张量相干性 (Structure Tensor Coherence):
          // 光学边缘有明显的空间方向一致性，随机噪点/白杂讯在局部各向同性
          const jxx = gx * gx;
          const jyy = gy * gy;
          const jxy = gx * gy;
          const trace = jxx + jyy + 1e-4;
          const coherence = ((jxx - jyy) ** 2 + 4 * (jxy ** 2)) / (trace ** 2);

          // 只有具备结构相干性且超过噪声门限的才被识别为有效光学细节
          const noiseThreshold = Math.max(4.0, noiseSigma * 2.2);
          if (gMag > noiseThreshold) {
            const cleanGrad = gMag - noiseThreshold;
            // 相干性因子压制随机无方向噪点
            const coherentWeight = Math.pow(Math.max(0, coherence), 1.2);
            coherentGradSum += cleanGrad * coherentWeight;
          }

          // 8-邻域 Laplacian 纹理算子 (去噪处理)
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
          const cleanLap = Math.max(0, lap - noiseSigma * 2.5);
          lapSum += cleanLap;
          count++;
        }
      }

      const meanCoherent = count > 0 ? coherentGradSum / count : 0;
      const meanLap = count > 0 ? lapSum / count : 0;
      const meanRawTenen = count > 0 ? rawTenenSum / count : 0;
      const variance =
        count > 0 ? Math.max(0, lumSqSum / count - (lumSum / count) ** 2) : 0;
      const contrast = maxLum - minLum;

      // 准确判断该网格是否包含真实光学纹理 (排除纯平坦区与纯噪点区)
      // 若噪点很大，方差虽然很高但 meanCoherent 会很小
      const hasTexture =
        contrast > 16 &&
        variance > Math.max(10, noiseSigma * 1.5) &&
        meanCoherent > 1.2 &&
        meanLap > 0.8;

      if (hasTexture) {
        totalTexturedBlocks++;
      }

      // 计算去噪和相干性加权后的光学清晰度指标
      let rawSharp = meanCoherent * 1.4 + meanLap * 0.4;

      // 如果检测到手机/ISP 机内过冲锐化，校准压制虚高白边
      if (isOversharpened && overshootPct > 10) {
        const debiasFactor = Math.max(0.35, 1.0 - (overshootPct - 10) * 0.02);
        rawSharp *= debiasFactor;
      }

      // 如果检测到严重 JPEG 8x8 块效应/马赛克，压制假边缘
      if (blockinessPct > 12) {
        const blockDebias = Math.max(0.4, 1.0 - (blockinessPct - 12) * 0.02);
        rawSharp *= blockDebias;
      }

      heatmapData[r * gridCols + c] = rawSharp;
      blockStats.push({
        sharpness: rawSharp,
        tenengrad: meanRawTenen,
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

  // 全图有效纹理置信度 (0~100%)
  const textureConfidence = Math.min(
    100,
    Math.round((totalTexturedBlocks / (gridCols * gridRows * 0.35)) * 100)
  );

  // 8. 9 个标准像场分区评估 (中心、4 角、4 边)
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
      if (stat.hasTexture || stat.sharpness > 0.8) {
        centerValues.push(stat.sharpness);
      }
    }
  }
  centerValues.sort((a, b) => b - a);
  const centerTopN = Math.max(1, Math.floor(centerValues.length * 0.35));
  const centerSalientMean =
    centerValues.length > 0
      ? centerValues.slice(0, centerTopN).reduce((a, b) => a + b, 0) / centerTopN
      : 2.0;

  // 9. 计算各分区的显著锐度 (Salient Percentile Sharpness)
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
    const hasValidTexture = textureCount >= Math.max(1, totalInZone * 0.12);

    // 取该区域前 30% 显著光学特征值
    const topCount = Math.max(1, Math.floor(zoneValues.length * 0.3));
    const salientAvg =
      zoneValues.slice(0, topCount).reduce((a, b) => a + b, 0) / topCount;

    // 区域与中心的相对光学解析比率
    const ratioToCenter = salientAvg / Math.max(1e-4, centerSalientMean);

    let score: number;
    if (cfg.id === 'center') {
      score = calculateAcutanceScore(
        salientAvg,
        isOversharpened,
        nativeH,
        nativeMegapixels,
        maxResolutionCap
      );
    } else {
      if (hasValidTexture) {
        const rawScore = calculateAcutanceScore(
          salientAvg,
          isOversharpened,
          nativeH,
          nativeMegapixels,
          maxResolutionCap
        );
        score = Math.round(
          rawScore * 0.7 +
            Math.min(maxResolutionCap, ratioToCenter * rawScore) * 0.3
        );
      } else {
        // 无有效高频纹理/散景区：根据实际实测背景微弱梯度计算，如平坦纯色区适度回落
        const rawScore = calculateAcutanceScore(
          salientAvg,
          isOversharpened,
          nativeH,
          nativeMegapixels,
          maxResolutionCap
        );
        score = Math.round(Math.max(15, Math.min(55, rawScore)));
      }
    }
    score = Math.max(10, Math.min(maxResolutionCap, score));

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

  // 10. 色散 (Chromatic Aberration) 与紫边分析
  const caResult = calculateChromaticAberration(
    rChan,
    gChan,
    bChan,
    sampleW,
    sampleH,
    noiseSigma
  );

  // 11. 暗角与相对照度 (Vignetting Profile)
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

  // 12. 计算中心锐度、边角平均锐度与衰减率
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

  // 13. 估算全图总画面解析力 (LW/PH, Line Widths per Picture Height)
  const baseLwphFactor = (centerSharpness / 100) * 0.70;
  let lwphEstimate = Math.round(baseLwphFactor * nativeH * 2);
  if (isOversharpened) {
    lwphEstimate = Math.round(lwphEstimate * 0.78);
  }
  if (isResolutionLimited) {
    lwphEstimate = Math.min(lwphEstimate, Math.round(nativeH * 1.5));
  }

  // 14. 综合光学评分体系 (0~100)
  // 基础加权合成：中心解析力 40% + 边角及一致性 30% + 色散抑制 15% + 暗角与照度 15%
  const caScore =
    caResult.averageCaPx < 0.4
      ? 95
      : caResult.averageCaPx < 0.8
      ? 85
      : caResult.averageCaPx < 1.4
      ? 70
      : caResult.averageCaPx < 2.2
      ? 50
      : 30;

  const vigScore =
    vigResult.relativeIlluminationPct >= 85
      ? 95
      : vigResult.relativeIlluminationPct >= 72
      ? 85
      : vigResult.relativeIlluminationPct >= 58
      ? 70
      : vigResult.relativeIlluminationPct >= 42
      ? 52
      : 35;

  // 严谨的像场一致性评分：边角锐度根据中心衰减率加权
  const consistencyScore = Math.max(
    10,
    Math.round(cornerAvgSharpness * (1.0 - Math.min(0.5, (edgeFalloffPct / 100) * 0.7)))
  );

  let rawOverallScore =
    centerSharpness * 0.40 +
    consistencyScore * 0.30 +
    caScore * 0.15 +
    vigScore * 0.15;

  // 15. 画质劣化惩罚：高噪声、JPEG 重度马赛克与过度计算锐化
  let totalPenalty = 0;

  // (1) 噪声 / 杂讯重度惩罚
  if (snrDb < 20 || noiseSigma > 12) {
    totalPenalty += 28; // 极高杂讯
  } else if (snrDb < 26 || noiseSigma > 8) {
    totalPenalty += 18; // 重度噪点
  } else if (snrDb < 32 || noiseSigma > 5) {
    totalPenalty += 8; // 中等噪点
  }

  // (2) JPEG 8x8 块效应/马赛克惩罚
  if (blockinessPct > 20) {
    totalPenalty += 20; // 严重马赛克/重压缩
  } else if (blockinessPct > 12) {
    totalPenalty += 10;
  }

  // (3) 机内过冲计算锐化白边惩罚
  if (isOversharpened && overshootPct > 15) {
    const sharpPenalty = Math.min(16, (overshootPct - 15) * 0.6);
    totalPenalty += sharpPenalty;
  }

  rawOverallScore = Math.max(15, rawOverallScore - totalPenalty);

  // 施加最高物理像素分辨率硬封顶 (Cap)
  const finalScore = Math.min(maxResolutionCap, Math.round(rawOverallScore));

  let gradeLevel: LensQualityResult['gradeLevel'] = 'B';
  let gradeTitle = '良好 (主流均衡)';
  // S 级 (旗舰级光学标杆)：必须同时满足总分 >= 88、中心极高解析 (>= 86)、边角衰减控制在 20% 以内且色散极小
  if (finalScore >= 88 && centerSharpness >= 86 && edgeFalloffPct <= 20 && caResult.averageCaPx <= 0.6) {
    gradeLevel = 'S';
    gradeTitle = '卓越 (旗舰级光学素质)';
  } else if (finalScore >= 78 && centerSharpness >= 75) {
    gradeLevel = 'A';
    gradeTitle = '优秀 (高分辨率锐利)';
  } else if (finalScore >= 62) {
    gradeLevel = 'B';
    gradeTitle = '良好 (主流均衡)';
  } else if (finalScore >= 45) {
    gradeLevel = 'C';
    gradeTitle = '普通 (边缘软化/存在色散)';
  } else {
    gradeLevel = 'D';
    gradeTitle = '偏低 (低解析力/高噪点/低像素限制)';
  }

  // 16. 生成智能光学诊断结论与拍摄建议
  const { diagnosisSummary, recommendations } = generateDiagnosis(
    finalScore,
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
    snrDb,
    noiseLevel,
    blockinessPct,
    isResolutionLimited,
    exif
  );

  return {
    overallScore: finalScore,
    gradeLevel,
    gradeTitle,
    centerSharpness,
    cornerAvgSharpness,
    edgeFalloffPct,
    overshootPct,
    isOversharpened,
    lwphEstimate,
    textureConfidence,
    snrDb: Math.round(snrDb * 10) / 10,
    noiseLevel,
    blockinessPct: Math.round(blockinessPct * 10) / 10,
    resolutionMegapixels: Math.round(nativeMegapixels * 10) / 10,
    isResolutionLimited,
    zones,
    chromaticAberration: caResult,
    vignetting: vigResult,
    heatmap,
    diagnosisSummary,
    recommendations,
  };
}

/**
 * 依据微观相干能量与物理像素尺度映射到光学锐度分 (0~100)
 */
function calculateAcutanceScore(
  coherentEnergy: number,
  isOversharpened: boolean,
  nativeHeight: number,
  megapixels: number,
  maxCap: number
): number {
  const energy = Math.max(0, coherentEnergy);

  // 严格的非线性光学相干传递函数 (基于 S 形响应曲线)
  // 0~2.0 (虚化/严重偏软): < 30 分
  // 2.0~4.5 (低对比/套头边缘): 35~55 分
  // 4.5~8.5 (主流中端/标准套头中心): 55~70 分
  // 8.5~15.0 (专业大光圈/高锐度定焦): 70~82 分
  // 15.0~26.0 (顶级旗舰/标杆光学解析): 82~92 分
  // 26.0+ (标板/极高反差): 92~98 分
  let baseScore = (Math.pow(energy, 1.15) / (Math.pow(energy, 1.15) + 6.5)) * 100;

  // 物理传感器像素采样约束 (限制低像素上限，但不对高像素无脑加分)
  if (megapixels < 2.0 || nativeHeight < 900) {
    baseScore *= 0.70;
  } else if (megapixels < 6.0 || nativeHeight < 1500) {
    baseScore *= 0.85;
  } else if (megapixels < 12.0) {
    baseScore *= 0.94;
  }

  // 计算摄影白边锐化去偏惩罚
  if (isOversharpened) {
    baseScore *= 0.90;
  }

  return Math.round(Math.min(maxCap, Math.max(10, baseScore)));
}

/**
 * 基于中位数绝对偏差 (MAD) 估算稳健高频噪声标准差与 SNR (dB)
 * Donoho & Johnstone 稳健噪声估计算法：sigma = median(|Laplacian|) / 0.6745
 */
function estimateNoiseAndSnr(
  gray: Float32Array,
  w: number,
  h: number,
  meanLum: number
): {
  noiseSigma: number;
  snrDb: number;
  noiseLevel: '极低噪点' | '正常低噪' | '中等噪点' | '重度高噪' | '极高杂讯';
} {
  const lapResiduals: number[] = [];
  const step = 4;

  for (let y = 4; y < h - 4; y += step) {
    const row = y * w;
    for (let x = 4; x < w - 4; x += step) {
      // 标准拉普拉斯高通滤波残差
      // [ 1, -2,  1]
      // [-2,  4, -2]
      // [ 1, -2,  1]
      const nVal =
        gray[row - w + (x - 1)] -
        2 * gray[row - w + x] +
        gray[row - w + (x + 1)] -
        2 * gray[row + (x - 1)] +
        4 * gray[row + x] -
        2 * gray[row + (x + 1)] +
        gray[row + w + (x - 1)] -
        2 * gray[row + w + x] +
        gray[row + w + (x + 1)];

      lapResiduals.push(Math.abs(nVal));
    }
  }

  if (lapResiduals.length === 0) {
    return { noiseSigma: 2.0, snrDb: 40, noiseLevel: '极低噪点' };
  }

  lapResiduals.sort((a, b) => a - b);
  // 取中位数 (MAD)
  const medianVal = lapResiduals[Math.floor(lapResiduals.length * 0.5)];
  // 归一化系数：sqrt(36) * 0.6745 = 4.047
  const noiseSigma = Math.max(0.5, medianVal / 4.047);

  // 信噪比计算 (dB)
  const signal = Math.max(10, meanLum);
  const snrDb = Math.min(60, Math.max(10, 20 * Math.log10(signal / noiseSigma)));

  let noiseLevel: '极低噪点' | '正常低噪' | '中等噪点' | '重度高噪' | '极高杂讯' = '正常低噪';
  if (snrDb >= 38 && noiseSigma <= 2.2) {
    noiseLevel = '极低噪点';
  } else if (snrDb >= 30 && noiseSigma <= 5.0) {
    noiseLevel = '正常低噪';
  } else if (snrDb >= 24 && noiseSigma <= 8.5) {
    noiseLevel = '中等噪点';
  } else if (snrDb >= 18 || noiseSigma <= 14.0) {
    noiseLevel = '重度高噪';
  } else {
    noiseLevel = '极高杂讯';
  }

  return {
    noiseSigma,
    snrDb,
    noiseLevel,
  };
}

/**
 * 探测 JPEG 8x8 块效应与数字马赛克伪影强度
 */
function detectJpegBlockiness(
  gray: Float32Array,
  w: number,
  h: number
): number {
  let gridGradSum = 0;
  let gridCount = 0;
  let nonGridGradSum = 0;
  let nonGridCount = 0;

  const step = 2;
  for (let y = 8; y < h - 8; y += step) {
    const row = y * w;
    const isYGrid = y % 8 === 0;
    for (let x = 8; x < w - 8; x += step) {
      const isXGrid = x % 8 === 0;
      const gx = Math.abs(gray[row + (x + 1)] - gray[row + (x - 1)]);
      const gy = Math.abs(gray[row + w + x] - gray[row - w + x]);

      if (isXGrid || isYGrid) {
        gridGradSum += gx + gy;
        gridCount++;
      } else if (x % 8 === 4 && y % 8 === 4) {
        nonGridGradSum += gx + gy;
        nonGridCount++;
      }
    }
  }

  if (gridCount === 0 || nonGridCount === 0) return 0;

  const avgGrid = gridGradSum / gridCount;
  const avgNonGrid = nonGridGradSum / nonGridCount;
  const ratio = (avgGrid - avgNonGrid) / Math.max(1, avgNonGrid);

  // 转换为 0~100% 块效应比例
  return Math.min(100, Math.max(0, ratio * 75));
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
      const g0 = gray[row + (x - 2)];
      const g1 = gray[row + (x - 1)];
      const g2 = gray[row + x];
      const g3 = gray[row + (x + 1)];
      const g4 = gray[row + (x + 2)];

      const jump = Math.abs(g3 - g1);
      if (jump > 35) {
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
 * 计算色散 (CA) 与紫边 (考虑噪声底噪过滤)
 */
function calculateChromaticAberration(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  noiseSigma: number
): ChromaticAberrationResult {
  let totalDelta = 0;
  let maxDelta = 0;
  let sampleCount = 0;
  let purpleFringeCount = 0;
  let totalEdgeCount = 0;

  const step = 4;
  const edgeThreshold = Math.max(35, noiseSigma * 5);

  for (let y = 10; y < h - 10; y += step) {
    const row = y * w;
    for (let x = 10; x < w - 10; x += step) {
      const gradG = Math.abs(g[row + (x + 1)] - g[row + (x - 1)]);
      if (gradG > edgeThreshold) {
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
 * 计算暗角与相对照度
 */
function calculateVignetting(
  gray: Float32Array,
  w: number,
  h: number
): VignettingResult {
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
  snrDb: number,
  noiseLevel: string,
  blockinessPct: number,
  isResolutionLimited: boolean,
  exif?: ExifOverview
): { diagnosisSummary: string; recommendations: string[] } {
  const recommendations: string[] = [];

  let centerDesc = `中心分辨率 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  if (centerSharpness >= 85) centerDesc = `中心解析力极高 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  else if (centerSharpness >= 70) centerDesc = `中心锐度优良 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  else if (centerSharpness >= 55) centerDesc = `中心锐度适中 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;
  else centerDesc = `中心解析力偏低/偏软 (${centerSharpness}分，边角 ${cornerAvgSharpness}分)`;

  let falloffDesc = `边缘画质衰减控制在 ${falloffPct}%，像场一致性优异`;
  if (falloffPct > 40) {
    falloffDesc = `边角画质衰减达 ${falloffPct}%（存在较明显软化/场曲）`;
    recommendations.push('建议收缩 1~2 档光圈拍摄风景或建筑，以显著提升边角解析力。');
  } else if (falloffPct > 22) {
    falloffDesc = `边角画质适度衰减 ${falloffPct}%（符合优质大光圈镜头正常光学特性）`;
    recommendations.push('主体置于中心或三分线区域可获得最佳锐利度。');
  } else {
    recommendations.push('像场一致性良好，可放心全开光圈使用。');
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

  // 噪点与画质诊断
  if (snrDb < 26) {
    recommendations.push(
      `⚠️ 画面检测到【${noiseLevel}】(信噪比 ${snrDb.toFixed(1)} dB)，杂讯严重破坏了微观光学细节，已执行降噪与去伪影扣分。`
    );
  }

  // JPEG 块效应诊断
  if (blockinessPct > 15) {
    recommendations.push(
      `⚠️ 检测到高强度 JPEG 8x8 压缩块效应/马赛克伪影 (${blockinessPct.toFixed(1)}%)，已算法去除非光学伪梯度。`
    );
  }

  // 物理低分辨率限制提示
  if (isResolutionLimited) {
    recommendations.push(
      `📐 原图物理分辨率仅 ${megapixels.toFixed(2)} MP，受到像素采样物理极限约束，无法传递高频光学微观纹理。`
    );
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
    overallScore >= 90 ? '卓越' : overallScore >= 80 ? '优秀' : overallScore >= 70 ? '良好' : overallScore >= 55 ? '普通' : '偏低'
  })，总画面估计解析力约 ${lwph} LW/PH (${megapixels.toFixed(1)}MP，信噪比 ${snrDb.toFixed(1)}dB)。${centerDesc}，${falloffDesc}。${caDesc}，${vigDesc}。${
    isResolutionLimited ? `[受${megapixels.toFixed(1)}MP低像素物理约束]` : ''
  }`;

  return {
    diagnosisSummary,
    recommendations,
  };
}
