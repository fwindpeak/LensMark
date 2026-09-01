
import type { MTFResult } from '../types/mtf';
export function MetricsCards({ result }: { result: MTFResult | null }) {
  if (!result?.isValid) return <section className="report-card"><h3>当前选区无法测量 MTF</h3><p>{result?.errorMessage || '请选择明暗斜边'}</p><p className="muted">测不到不等于镜头差。调整选区，或使用合成斜边演示。</p></section>;
  return <section className="report-card"><div className="metric-grid"><div><span>当前选区 MTF50</span><strong>{result.mtf50?.toFixed(3) ?? '未找到交点'}</strong><small>cycles/pixel · 0–0.5 范围</small></div><div><span>边缘倾角</span><strong>{result.angleDeg.toFixed(2)}<small>°</small></strong><small>拟合残差 {result.fitResidualPx?.toFixed(2)} px</small></div></div>{result.warnings?.map(w => <p className="muted" key={w}>{w}</p>)}</section>;
}
