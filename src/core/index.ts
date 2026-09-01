import { ROI, MTFResult } from '../types/mtf';
import { extractLinearGrayscale } from './grayscale';
import { fitSlantedEdge } from './edgeDetection';
import { buildEsfAndLsf } from './esfLsf';
import { computeMtfFromLsf } from './dft';

export * from './synthetic';
export * from './grayscale';
export * from './edgeDetection';
export * from './esfLsf';
export * from './dft';

/**
 * 执行完整的 ISO 12233 斜边分析管线
 */
export function analyzeMtf(
  imageSource: CanvasImageSource,
  roi: ROI
): MTFResult {
  if (roi.w < 10 || roi.h < 10) {
    return {
      isValid: false,
      angleDeg: 0,
      k: 0,
      b: 0,
      mtf50: 0,
      mtf: [],
      esf: [],
      lsf: [],
      winLen: 128,
      oversampling: 4,
      edgeCount: 0,
      totalRows: 0,
      errorMessage: '选区过小 (需至少 10×10 像素)',
    };
  }

  try {
    // 1. 提取物理线性灰度
    const { gray, width, height } = extractLinearGrayscale(imageSource, roi);

    // 2. 边缘导数质心与直线方程拟合
    const fitted = fitSlantedEdge(gray, width, height);
    if (!fitted) {
      return {
        isValid: false,
        angleDeg: 0,
        k: 0,
        b: 0,
        mtf50: 0,
        mtf: [],
        esf: [],
        lsf: [],
        winLen: 128,
        oversampling: 4,
        edgeCount: 0,
        totalRows: height,
        errorMessage: '边缘反差过低或未能检出清晰倾斜边缘',
      };
    }

    // 3. 4x 超采样 ESF 与汉宁窗 LSF
    const oversampling = 4;
    const winLen = 128;
    const { esf, lsf } = buildEsfAndLsf(
      gray,
      width,
      height,
      fitted.k,
      fitted.b,
      oversampling,
      winLen
    );

    // 4. DFT 频域幅值与 MTF50
    const { mtf, mtf50 } = computeMtfFromLsf(lsf, oversampling, 64);

    return {
      isValid: true,
      angleDeg: fitted.angleDeg,
      k: fitted.k,
      b: fitted.b,
      mtf50,
      mtf,
      esf,
      lsf,
      winLen,
      oversampling,
      edgeCount: fitted.validRowCount,
      totalRows: height,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析过程发生未知异常';
    return {
      isValid: false,
      angleDeg: 0,
      k: 0,
      b: 0,
      mtf50: 0,
      mtf: [],
      esf: [],
      lsf: [],
      winLen: 128,
      oversampling: 4,
      edgeCount: 0,
      totalRows: 0,
      errorMessage: message,
    };
  }
}
