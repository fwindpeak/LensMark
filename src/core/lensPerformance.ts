
import type { LensPerformanceReport, SourceKind } from '../types/evaluation.ts';
import type { MTFResult } from '../types/mtf.ts';
export function evaluateLensPerformance(mtf: MTFResult | null, source: SourceKind): LensPerformanceReport {
  return {
    resolution: {
      name: '当前选区 MTF50', status: mtf?.isValid ? '局部系统测量' : '无法评价', value: mtf?.isValid ? mtf.mtf50 : null, unit: 'cycles/pixel',
      evidence: mtf?.isValid ? '通过局部斜边筛查，倾角 ' + mtf.angleDeg.toFixed(2) + '°。只测量当前框选位置，不推算中心或边角。' : mtf?.errorMessage || '请先框选合适的斜边。',
      required: '固定机身、同一靶面与拍摄比例、相同曝光和处理流程；每个像场位置独立取样并重复对焦拍摄。',
    },
    otherMetrics: [
      { name: '横向色差', required: '拍摄中性黑白高反差边缘，记录镜头校正状态；需实现并验证 RGB 边缘位置拟合。' },
      { name: '光学暗角', required: '拍摄均匀照明的平场，使用黑电平已扣除的线性数据；普通照片亮度差包含场景照明。' },
      { name: '几何畸变', required: '拍摄平行对齐的网格标板，校准透视；需实现并验证网格坐标拟合。' },
    ].map(m => ({ ...m, status: '无法评价', value: null, unit: '', evidence: '当前版本没有经过验证的定量测量，保留为空。' })),
    checks: [
      { title: '局部边缘条件', status: mtf?.isValid ? '已检查' : '未确认', evidence: mtf?.isValid ? '已检查倾角、单边结构、拟合残差和截断；不是 ISO 认证。' : '未通过局部斜边筛查。' },
      { title: '对焦、景深与抖动', status: '未确认', evidence: '单张照片无法排除失焦、焦平面倾斜或相机抖动；需重复拍摄与包围对焦。' },
      { title: '图像来源与处理', status: '未确认', evidence: source === 'raw_preview' ? '当前是 RAW 内嵌 JPEG 预览，不能用于原像素镜头比较。' : source === 'raw_rendered' ? '当前使用去马赛克、白平衡和量化后的 8-bit 图像，不是线性传感器原始数据。' : source === 'synthetic' ? '这是算法演示，不包含真实镜头证据。' : '锐化、降噪、镜头校正和历史缩放状态未知。' },
    ],
    disclaimer: '从照片得到的是镜头、传感器、对焦和处理流程共同作用的响应。只有控制其他条件后，才可用多张照片比较镜头。当前不生成镜头总分。',
  };
}
