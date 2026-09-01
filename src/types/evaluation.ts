import { ROI } from './mtf';

export type ReportViewMode = 'photo_quality' | 'lens_performance' | 'dual_overview';

// ==========================================
// 1. 照片技术质量 (Photo Technical Quality)
// ==========================================

export interface SubjectSharpness {
  roi: ROI;
  subjectScore: number; // 0 ~ 100
  detailLevel: '极丰富细节' | '丰富细节' | '常规细节' | '细节涂抹偏软' | '明显欠焦/模糊';
  inFocusRatioPct: number; // 画面处于合焦/清晰景深的面积比例 (%)
  outOfFocusRatioPct: number; // 焦外虚化区域比例 (%)
  isBackgroundBlurred: boolean; // 背景是否存在大光圈/浅景深虚化
  note: string; // "背景虚化不计入主体清晰度扣分"
  tenengrad: number;
  laplacianVar: number;
}

export interface FlatRegionNoise {
  flatCoveragePct: number; // 检出的纯平坦/低纹理区域占总画面的百分比 (%)
  luminanceNoiseSigma: number; // 平坦区亮度噪声标准差 (0 ~ 255)
  chromaNoiseSigma: number; // 平坦区色度噪声标准差 (0 ~ 255)
  snrDb: number; // 平坦区实测信噪比 (dB)
  noiseGrade: '极纯净 (极低噪点)' | '纯净 (正常低噪)' | '中等噪点' | '明显噪点' | '重度杂讯';
  hasPatternNoise: boolean; // 是否存在条纹/结构噪声
  note: string; // "基于自适应平坦区测量，避免将纹理误判为噪声；高 ISO 噪点不作为镜头扣分项"
}

export interface ExposureToneGradation {
  meanLuminance: number; // 平均亮度 (0 ~ 255)
  highlightClippingPct: number; // 高光截断溢出比例 (Lum > 254) %
  shadowClippingPct: number; // 暗部死黑截断比例 (Lum < 2) %
  rgbClipping: {
    rMaxPct: number;
    gMaxPct: number;
    bMaxPct: number;
  };
  midtoneContrast: '高反差' | '适中层次' | '低反差柔和' | '灰雾平淡';
  isNightSceneOrDark: boolean; // 是否疑似夜景/暗调场景
  dynamicRangeNote: string; // "单张照片明暗分布反映本次曝光，不等于相机极限宽容度"
}

export interface ColorPerformance {
  hasChannelOverflow: boolean; // 是否存在单色通道饱和溢出
  posterizationScore: number; // 色阶断层/色带风险评分 (0~100, 越高越平滑)
  wbEvaluation: {
    hasColorChart: boolean;
    wbDeviationDescription: string; // "无标准色卡参考，不作主观偏色或色偏断言"
  };
}

export interface ProcessingArtifacts {
  overshootPct: number; // ISO 12233 边缘白边/过冲率 (%)
  hasSharpeningHalos: boolean; // 是否检测到机内过度锐化光晕/振铃
  jpegBlockinessPct: number; // JPEG 8x8 DCT 块效应马赛克强度 (%)
  suspectedNrSmearing: boolean; // 是否检测到降噪算法涂抹痕迹
  processingSummary: string; // 处理痕迹对画质的综合影响描述
}

export interface ObservedPhenomena {
  observedFringingWidthPx: number; // 观察到的边缘彩边最大宽度 (px)
  observedCornerDarkeningEv: number; // 观察到的四角相对中心变暗 (EV)
  observedDistortionVisual: '平直' | '微弱形变' | '可见弯曲';
  observedGhostingOrFlare: boolean; // 画面是否存在强烈耀斑/眩光泛白
  disclaimer: string; // "上述为本次成片中观察到的局部视觉现象，是否归因于镜头需经归因检查"
}

export interface PhotoQualityReport {
  overallTechnicalSummary: string;
  subjectSharpness: SubjectSharpness;
  flatNoise: FlatRegionNoise;
  exposureTone: ExposureToneGradation;
  colorPerformance: ColorPerformance;
  processingArtifacts: ProcessingArtifacts;
  observedPhenomena: ObservedPhenomena;
  resolutionMegapixels: number;
  imageDimensions: { width: number; height: number };
}

// ==========================================
// 2. 归因检查机制 (Attribution Check)
// ==========================================

export type CheckStatus = 'passed' | 'warning' | 'failed' | 'not_applicable';

export interface AttributionCheckItem {
  id: string;
  title: string;
  status: CheckStatus;
  evidence: string;
  impact: string;
}

export interface AttributionCheckResult {
  overallValidForLensTest: boolean;
  checks: {
    dofAndDefocus: AttributionCheckItem; // 景深与失焦
    motionAndShake: AttributionCheckItem; // 运动模糊与快门抖动
    lightingUniformity: AttributionCheckItem; // 场景照明均匀性
    ispAndSharpening: AttributionCheckItem; // 后期锐化与降噪处理
    targetAndChart: AttributionCheckItem; // 测试标板与边缘方向有效性
  };
}

// ==========================================
// 3. 镜头光学表现 (Lens Optical Performance)
// ==========================================

export type MetricValidity = '可测' | '仅供参考' | '无法评价 (缺少测试条件)';

export interface OpticalMetric<T> {
  name: string;
  validity: MetricValidity;
  value: T | null;
  unit: string;
  testConditionRequired: string;
  actualConditionObserved: string;
  interferenceRisks: string[];
  missingEvidence?: string[];
  reproducibilityNote?: string;
}

export interface ResolutionData {
  mtf50Center: number; // c/p
  mtf50Mid: number; // c/p (0.7 像高)
  mtf50Corner: number; // c/p (边缘四角)
  lwphEstimateCenter: number; // LW/PH
  lwphEstimateCorner: number; // LW/PH
  cornerFalloffPct: number; // 边缘相对中心衰减率 %
  isSymmetric: boolean; // 左右/上下对称性
}

export interface LateralCaData {
  rbShiftPx: number; // 边缘红/蓝通道相对绿色通道的位移差 (px)
  maxFringeWidthPx: number; // 最大彩边像素跨度
  isProfileCorrectedKnown: boolean; // 机身镜头校正配置文件状态是否已知
  grade: '极佳 (几乎无色散)' | '良好 (轻微色散)' | '中等色散' | '严重色差';
}

export interface VignettingData {
  falloffEv: number; // 边角光照衰减 (EV)
  relativeIlluminationPct: number; // 相对照度 % (中心=100%)
  profileCurvature: '平缓渐变' | '急剧衰减' | '自然过渡';
}

export interface DistortionData {
  distortionPct: number; // 畸变率 % (正为枕形，负为桶形)
  distortionType: '桶形畸变' | '枕形畸变' | '复杂波浪形' | '无显著畸变';
}

export interface LensPerformanceReport {
  lensMetadata: {
    lensModel: string;
    cameraBody: string;
    focalLength: string;
    aperture: string;
    focusDistance: string;
    iso: string;
    shutterSpeed: string;
    sourceFormat: 'RAW (纯净线性数据)' | 'RAW 内嵌 JPEG' | '标准 JPEG (机内渲染)';
  };
  attributionCheck: AttributionCheckResult;
  resolution: OpticalMetric<ResolutionData>;
  lateralCa: OpticalMetric<LateralCaData>;
  vignetting: OpticalMetric<VignettingData>;
  distortion: OpticalMetric<DistortionData>;
  locaNote: {
    status: '无法由单张成片定量';
    requirement: string;
  };
  flareNote: {
    status: '无法定量评价';
    requirement: string;
  };
  bokehNote: {
    status: '定性特征观察';
    requirement: string;
  };
  systemMtfDisclaimer: string; // "严格来说，从照片测得的 MTF 是镜头、传感器和处理流程共同作用的系统响应。固定机身与流程后可作为镜头横向对比。"
}

export interface DualEvaluationResult {
  photoQuality: PhotoQualityReport;
  lensPerformance: LensPerformanceReport;
}
