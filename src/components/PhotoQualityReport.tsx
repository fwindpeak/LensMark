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
          {subjectOnly ? '已选主体 · 局部清晰度' : '自动照片评价'}
        </div>
        <h2>{assessment.title}</h2>
        <p>{assessment.summary}</p>
        <small>
          已测评分权重 {Math.round(assessment.coverage * 100)}% ·
          启发式参考，不是审美分数或镜头排名
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
              <summary>怎么看 / 怎么改善</summary>
              <p>{m.advice}</p>
              {m.value !== null && (
                <small>
                  {m.value.toFixed(2)} {m.unit}
                </small>
              )}
            </details>
          </article>
        ))}
      </section>
      <section className="report-card tips">
        <h3>建议先做什么</h3>
        {assessment.suggestions.length ? (
          <ol>
            {assessment.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : (
          <p>
            先放大确认关键主体。若要比较镜头，切到“镜头评价”，查看各位置解析力与色差。
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
          <span>暗部</span>
          <span>中间调</span>
          <span>高光</span>
        </div>
        <p>
          清晰度 45% + 曝光保留 30% + 纯净度
          25%；缺失项不当作满分，按已测权重归一。缺少清晰度时只给分项结论，不给总分。
        </p>
        <p>
          清晰度使用较清晰的一半有效区域，减少背景虚化干扰；自动采样不是主体识别。可在图片上点选主体复查。
        </p>
        <p>
          明暗层次只作描述，不因黑白、低饱和或创作风格扣分。手机照片得到较好技术参考分，也不表示它使用了优秀镜头。
        </p>
        <p className="muted">
          {photo.noise.note} 曝光概览 {photo.overviewDimensions.width}×
          {photo.overviewDimensions.height}；细节与噪声均取原像素。
        </p>
      </details>
    </>
  );
}
