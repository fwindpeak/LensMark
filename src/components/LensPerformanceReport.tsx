
import type { LensPerformanceReport as Report } from '../types/evaluation';
export function LensPerformanceReport({ report, onSwitchToEdgeRoiMode }: { report: Report; onSwitchToEdgeRoiMode: () => void }) {
  return <>
    <section className="report-card"><div className="eyebrow">镜头证据</div><h2>这张照片能说明多少？</h2><p>{report.disclaimer}</p></section>
    <section className="report-card"><h3>{report.resolution.name}<span className="tag">{report.resolution.status}</span></h3><p>{report.resolution.evidence}</p><p>{report.resolution.required}</p><button onClick={onSwitchToEdgeRoiMode}>框选斜边并测量 →</button></section>
    {report.otherMetrics.map(m => <section className="report-card" key={m.name}><h3>{m.name}<span className="tag">无法评价</span></h3><p>{m.evidence}</p><p className="muted">需要：{m.required}</p></section>)}
    <section className="report-card"><h3>已知条件与缺少的证据</h3>{report.checks.map(c => <div className="check-row" key={c.title}><b>{c.title} · {c.status}</b><p>{c.evidence}</p></div>)}</section>
  </>;
}
