import type { AnalysisResult } from '../types/evaluation';
import type { PhotoAssessment } from '../types/assessment';

export function PhotoSummary({
  assessment,
  subjectOnly,
}: {
  assessment: PhotoAssessment;
  subjectOnly: boolean;
}) {
  return (
    <section className={'result-summary ' + assessment.rating}>
      <div className="score-dial">
        <strong>{assessment.score ?? '—'}</strong>
        <span>技术参考分</span>
      </div>
      <div>
        <div className="eyebrow">
          {subjectOnly ? '已选主体 · 局部解像力' : '自动照片质感评估'}
        </div>
        <h2>{assessment.title}</h2>
        <p>{assessment.summary}</p>
        <small>
          已测指标权重覆盖率 {Math.round(assessment.coverage * 100)}% ·
          基于客观像素数据（非艺术审美评分）
        </small>
      </div>
    </section>
  );
}
export function PhotoQualityReport({ result }: { result: AnalysisResult }) {
  const { assessment, photo } = result;
  const max = Math.max(1, ...assessment.histogram);
  return (
    <>
      <section className="quality-grid" aria-label="照片评价指标">
        {assessment.metrics.map((m) => (
          <article className={'metric-card ' + m.rating} key={m.id}>
            <div className="metric-title">
              {m.name}
              <span className={'rating-dot ' + m.rating} />
            </div>
            <h3>{m.label}</h3>
            <p>{m.summary}</p>
            {m.score !== null && (
              <meter
                min="0"
                max="100"
                value={m.score}
                aria-label={m.name + '参考分'}
              />
            )}
            <details>
              <summary>维度分析与优化建议</summary>
              <p>{m.advice}</p>
              {m.value !== null && (
                <small>
                  实测数据: {m.value.toFixed(2)} {m.unit}
                </small>
              )}
            </details>
          </article>
        ))}
      </section>
      <section className="report-card tips">
        <h3>拍摄与画质建议</h3>
        {assessment.suggestions.length ? (
          <ol>
            {assessment.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <p>
            建议放大检查核心主体焦平面。若需对比不同镜头/光圈的表现，请切换至“镜头评价”面板。
          </p>
        )}
      </section>
      <details className="report-card">
        <summary>亮度分布与评分依据</summary>
        <svg
          className="histogram"
          viewBox="0 0 256 80"
          role="img"
          aria-label="亮度直方图，左侧暗部，右侧高光"
        >
          {assessment.histogram.map((v, i) => (
            <rect
              key={i}
              x={i * 4}
              y={80 - (v / max) * 76}
              width="3"
              height={(v / max) * 76}
              fill="currentColor"
            />
          ))}
        </svg>
        <div className="range-labels">
          <span>暗部 (Shadows)</span>
          <span>中间调 (Midtones)</span>
          <span>高光 (Highlights)</span>
        </div>
        <p>
          综合参考分权项：解像清晰度 45% + 曝光保留动态范围 30% + 画面纯净度 (SNR)
          25%；未测项目按已测有效权重自动归一化计算。
        </p>
        <p>
          清晰度采样优先选择图像中解像最高的前 50% 有效区域，最大程度降低背景景深虚化对整体判定的干扰。可以在工作台上点击关键主体进行单独精准复查。
        </p>
        <p className="muted">
          {photo.noise.note} 预览采样分辨率 {photo.overviewDimensions.width}×
          {photo.overviewDimensions.height}；解像细节与噪声指标均从原像素精准提取。
        </p>
      </details>
    </>
  );
}

