
import type { PhotoQualityReport as Report } from '../types/evaluation';
export function PhotoQualityReport({ report }: { report: Report }) {
  const { exposure: e, noise, subject, overviewDimensions: size } = report;
  const metric = (v: number | null, digits = 2) => v === null ? '无法估计' : v.toFixed(digits);
  return <>
    <section className="report-card"><div className="eyebrow">照片检查</div><h2>先看这张照片发生了什么</h2><p>曝光分布、噪声残差和局部细节分别呈现。场景不同，不能直接用一个总分排名。</p></section>
    <section className="report-card"><h3>曝光与通道截断</h3><div className="metric-grid">
      <div><span>接近白色上限</span><strong>{metric(e.highlightsPct)}<small>%</small></strong></div>
      <div><span>接近黑色下限</span><strong>{metric(e.shadowsPct)}<small>%</small></strong></div>
    </div><p>R / G / B 通道上限占比：{e.channelClippingPct.map(v => metric(v) + '%').join(' / ')}</p><p className="muted">概览采样 {size.width}×{size.height}，缩放可能漏掉细小截断。分布不等于曝光对错，也不代表传感器动态范围。</p></section>
    <section className="report-card"><h3>平坦区噪声估计 <span className="tag">原像素采样</span></h3><div className="metric-grid">
      <div><span>亮度残差 σ · 8-bit 码值</span><strong>{metric(noise.sigma)}</strong></div>
      <div><span>平坦区信号 / 残差</span><strong>{metric(noise.snrDb, 1)}{noise.snrDb !== null && <small>dB</small>}</strong></div>
    </div><p>{noise.note}</p><p className="muted">有效平坦块 {noise.patches} / 候选 {noise.candidates}；仅扫描九处原像素小块，不代表全图每个区域。</p></section>
    <section className="report-card"><h3>当前选区的细节</h3><p>{subject.note}</p><dl className="data-list"><dt>梯度 RMS</dt><dd>{metric(subject.gradientRms)}</dd><dt>Laplacian 方差</dt><dd>{metric(subject.laplacianVariance)}</dd><dt>实际采样</dt><dd>{subject.roi.w}×{subject.roi.h} px</dd></dl><p className="muted">选区超过 512 px 时，取中间 512×512 原像素，不缩图计算。未进行语义主体识别或合焦面积估计。</p></section>
    <section className="report-card"><h3>下一步怎么拍</h3><ul>{report.recommendations.map(t => <li key={t}>{t}</li>)}</ul></section>
  </>;
}
