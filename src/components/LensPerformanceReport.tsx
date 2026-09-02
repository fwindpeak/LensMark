import type { AnalysisResult } from '../types/evaluation';
import type { TestScene, ZoneMeasurement } from '../types/assessment';
import type { ROI } from '../types/mtf';
import { downloadText } from '../core/comparison';
import { targetSvg } from '../core/demoImages';
import type { DemoKind } from '../core/demoImages';

export const SCENES: { id: TestScene; label: string; tip: string }[] = [
  {
    id: 'general',
    label: '普通实拍',
    tip: '自动寻找可测轮廓，观察当前照片的镜头成像表现。无需先框选。',
  },
  {
    id: 'resolution',
    label: '解析力 / 色差',
    tip: '拍摄平整的中性斜边靶，同一平面覆盖中心与边角；相机正对靶面。',
  },
  {
    id: 'flat',
    label: '暗角',
    tip: '用均匀照明的白墙或漫射板填满画面，稍微失焦，不要过曝。不要用普通风景判断暗角。',
  },
  {
    id: 'grid',
    label: '畸变',
    tip: '拍满横竖网格，至少覆盖画面外侧；相机尽量正对，线条须真实笔直。',
  },
];
const value = (v: number | null, digits = 3) =>
  v === null ? '待补样张' : v.toFixed(digits);
export const mtfLabel = (v: number | null) =>
  v === null
    ? '未找到可测边缘'
    : v >= 0.25
      ? '局部解析较强'
      : v >= 0.16
        ? '局部解析良好'
        : v >= 0.1
          ? '局部偏柔'
          : '建议复查合焦';
function ZoneGrid({
  zones,
  onSelect,
}: {
  zones: ZoneMeasurement[];
  onSelect: (roi: ROI) => void;
}) {
  return (
    <div className="zone-grid" aria-label="九区解析力分布">
      {zones.map((z) => (
        <button
          key={z.id}
          className={
            'zone-cell ' +
            (z.mtf50 === null ? 'unknown' : z.mtf50 >= 0.16 ? 'good' : 'fair')
          }
          disabled={!z.roi}
          onClick={() => z.roi && onSelect(z.roi)}
        >
          <span>{z.name}</span>
          <strong>{z.mtf50?.toFixed(3) ?? '—'}</strong>
          <small>
            {z.mtf50 === null
              ? '待取样'
              : (z.orientation === 'vertical' ? '竖向边缘' : '横向边缘') +
                ' · ' +
                z.samples +
                ' 处'}
          </small>
        </button>
      ))}
    </div>
  );
}
export function LensPerformanceReport({
  result,
  scene,
  onScene,
  onSelect,
  onDemo,
}: {
  result: AnalysisResult;
  scene: TestScene;
  onScene: (scene: TestScene) => void;
  onSelect: (roi: ROI) => void;
  onDemo: (kind: DemoKind) => void;
}) {
  const lens = result.lens,
    count = lens.zones.filter((z) => z.mtf50 !== null).length;
  return (
    <>
      <section className="report-card scene-picker">
        <h3>你要测什么？</h3>
        <div className="segmented">
          {SCENES.map((s) => (
            <button
              key={s.id}
              aria-pressed={scene === s.id}
              onClick={() => onScene(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p>{SCENES.find((s) => s.id === scene)?.tip}</p>
      </section>
      {(scene === 'general' || scene === 'resolution') && (
        <>
          <section className="report-card">
            <div className="section-heading">
              <h3>解析力分布</h3>
              <span className="tag">{count} / 9 区已测</span>
            </div>
            <div className="metric-grid">
              <div>
                <span>中心 MTF50</span>
                <strong>{value(lens.centerMtf50)}</strong>
                <small>{mtfLabel(lens.centerMtf50)}</small>
              </div>
              <div>
                <span>同方向已测四角中位数</span>
                <strong>{value(lens.edgeMtf50)}</strong>
                <small>
                  {mtfLabel(lens.edgeMtf50)}
                  {lens.edgeOrientation
                    ? ' · ' +
                      (lens.edgeOrientation === 'vertical' ? '竖边' : '横边')
                    : ''}
                </small>
              </div>
            </div>
            <ZoneGrid zones={lens.zones} onSelect={onSelect} />
            <p className="muted">
              单位
              cycles/pixel，越高表示该处对细节的传递越强。点击区域看曲线。未取样区不推算；横竖方向不混合平均。
            </p>
            {!count && (
              <div className="inline-help">
                <p>
                  这张照片没有合适的直斜边，不影响照片评价。用下方练习靶可完成镜头解析力测试。
                </p>
                <button onClick={() => onDemo('detail')}>体验解析力测量</button>
              </div>
            )}
            <details>
              <summary>如何据此评价镜头</summary>
              <p>
                同机身、同焦距、同曝光和后期下，比较相同位置和方向的数值；用对比页看差值与重复测量波动。中心强而四角弱可能来自镜头、景深或靶面倾斜，要重复合焦排除干扰。
              </p>
              <p>
                “较强/偏柔”是原像素经验提示，不是跨机身标准评级。自然照片各处纹理、距离不同，不用九区差异直接判镜头偏心。
              </p>
            </details>
          </section>
          <section className="report-card">
            <h3>横向色差 / RGB 边缘错位</h3>
            <div className="single-value">
              {value(lens.caPx, 2)}
              {lens.caPx !== null && <small> px</small>}
            </div>
            <p>
              {lens.caPx === null
                ? '外侧尚未找到满足条件的中性边缘。换用黑灰斜边靶可测；有颜色的物体不当作色差。'
                : lens.caPx < 0.5
                  ? '测得通道错位较轻，当前成片彩边控制较好。'
                  : lens.caPx < 1.2
                    ? '存在可见的通道错位，可在高反差边缘放大检查。'
                    : '通道错位较明显，建议核对镜头校正前后的变化。'}
            </p>
            <details>
              <summary>测量口径</summary>
              <p>
                仅统计外侧、近切向的中性边缘，计算 R/G、B/G
                归一化边缘重心的最大差，再取中位数。单位是边缘法向原像素，非纵向色差。机内校正与去马赛克可能改变结果。
              </p>
            </details>
          </section>
          <section className="report-card supplementary">
            <h3>补齐镜头表现</h3>
            <button onClick={() => onScene('flat')}>
              测暗角 <span>平场照片 →</span>
            </button>
            <button onClick={() => onScene('grid')}>
              测畸变 <span>网格照片 →</span>
            </button>
          </section>
        </>
      )}
      {scene === 'flat' && (
        <section className="report-card">
          <h3>暗角与亮度均匀性</h3>
          <div className="single-value">
            {value(lens.flat?.falloffEv ?? null, 2)}
            {lens.flat?.valid && <small> EV</small>}
          </div>
          <p>
            {lens.flat?.valid
              ? lens.flat.falloffEv! < 0.4
                ? '角落衰减较轻，当前成片亮度比较均匀。'
                : lens.flat.falloffEv! < 1
                  ? '有一定暗角，可按风格保留或校正。'
                  : '暗角较明显，可尝试收小光圈或启用暗角校正。'
              : '还没有可用的平场测量。'}
          </p>
          <p>{lens.flat?.message}</p>
          {lens.flat?.valid && (
            <>
              <div className="illumination-grid" aria-label="7乘7亮度衰减图">
                {lens.flat.grid.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor:
                        'rgba(56, 189, 248, ' +
                        Math.max(0.08, 0.8 - v * 0.45) +
                        ')',
                    }}
                  >
                    {v.toFixed(1)}
                  </div>
                ))}
              </div>
              <small>
                每格为相对中心的 EV 衰减；四角差{' '}
                {lens.flat.asymmetryEv?.toFixed(2)}{' '}
                EV。采样位置在角落区域内，不是最边缘像素。
              </small>
            </>
          )}
          {!lens.flat?.valid && (
            <button onClick={() => onDemo('flat')}>体验平场测量</button>
          )}
        </section>
      )}
      {scene === 'grid' && (
        <section className="report-card">
          <h3>几何畸变</h3>
          <div className="single-value">
            {value(lens.distortion?.cornerDistortionPct ?? null, 2)}
            {lens.distortion?.valid && <small>%</small>}
          </div>
          <p>{lens.distortion?.message}</p>
          {lens.distortion?.valid && (
            <>
              <p>
                已拟合 {lens.distortion.lines.length} 条网格线。
                {Math.abs(lens.distortion.cornerDistortionPct!) < 1
                  ? '当前成片的直线保持较好。'
                  : '可尝试镜头配置文件校正；比较时要统一校正状态。'}
              </p>
              <details>
                <summary>数值含义</summary>
                <p>
                  负值为桶形，正值为枕形。这里是以半对角线归一化的单参数 k₁
                  模型角点畸变估计，不是 TV
                  畸变。无法拟合复杂波浪畸变或恢复完整相机标定。
                </p>
              </details>
            </>
          )}
          {!lens.distortion?.valid && (
            <button onClick={() => onDemo('grid')}>体验网格测量</button>
          )}
        </section>
      )}
      <section className="report-card target-download">
        <h3>准备测试样张</h3>
        <p>
          同一机身，每支镜头或每档光圈拍 3–5
          张；保持距离、光照、构图与后期一致，再批量上传。
        </p>
        <button
          onClick={() =>
            downloadText(
              'LensMark-slanted-target.svg',
              targetSvg('resolution'),
              'image/svg+xml',
            )
          }
        >
          下载斜边练习靶
        </button>
        <button
          onClick={() =>
            downloadText(
              'LensMark-grid-target.svg',
              targetSvg('grid'),
              'image/svg+xml',
            )
          }
        >
          下载网格靶
        </button>
        <small>
          打印靶自身的清晰度也会限制测量；这些是练习靶，不是认证标板。
        </small>
      </section>
    </>
  );
}
