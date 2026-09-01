
import type { MeasurementRecord } from '../types/evaluation.ts';
export function comparisonIssues(a: MeasurementRecord, b: MeasurementRecord): string[] {
  const issues: string[] = [];
  if (!a.camera || !b.camera || a.camera !== b.camera) issues.push('机身不同或未知');
  if (!a.lens || !b.lens) issues.push('镜头标识缺失');
  if (!a.aperture || !b.aperture || a.aperture !== b.aperture) issues.push('光圈不同或未知');
  if (!a.focalLength || !b.focalLength || Math.abs(a.focalLength - b.focalLength) > 0.5) issues.push('焦距不同或未知');
  if (!a.iso || !b.iso || a.iso !== b.iso) issues.push('ISO 不同或未知');
  if (a.width !== b.width || a.height !== b.height) issues.push('像素尺寸不同');
  if (a.source !== b.source || ['raw_preview', 'synthetic'].includes(a.source) || ['raw_preview', 'synthetic'].includes(b.source)) issues.push('来源不适合实拍对比');
  if (a.orientation !== b.orientation) issues.push('边缘方向不同');
  const cx = (r: MeasurementRecord) => (r.roi.x + r.roi.w / 2) / r.width;
  const cy = (r: MeasurementRecord) => (r.roi.y + r.roi.h / 2) / r.height;
  if (Math.hypot(cx(a) - cx(b), cy(a) - cy(b)) > 0.05) issues.push('选区像场位置不同');
  if (a.mtf50 === null || b.mtf50 === null) issues.push('缺少可比较的 MTF50 交点');
  return issues;
}
export function recordsToCsv(records: MeasurementRecord[]): string {
  const cell = (value: unknown) => {
    const s = String(value ?? '');
    const safe = /^[=+\-@\t\r\n]/.test(s) ? "'" + s : s;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const fields = ['fileName', 'camera', 'lens', 'aperture', 'focalLength', 'iso', 'width', 'height', 'source', 'mtf50', 'angle', 'orientation', 'createdAt'] as const;
  return '\ufeff' + [fields.join(','), ...records.map(r => fields.map(key => cell(r[key])).concat([r.roi.x, r.roi.y, r.roi.w, r.roi.h].map(cell)).join(','))].map((row, i) => i === 0 ? row + ',roiX,roiY,roiWidth,roiHeight' : row).join('\r\n');
}
export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
