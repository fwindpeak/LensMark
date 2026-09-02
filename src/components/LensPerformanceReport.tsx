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
    tip: '自动定位画面可测轮廓，评估当前日常实拍的解像表现（无需预先框选）。',
  },
  {
    id: 'resolution',
    label: '解析力 / 色差',
    tip: '拍摄平整的斜边测试靶（相机正对靶面），覆盖画面中心与九区边缘，定量计算 MTF50 与色散。',
  },
  {
    id: 'flat',
    label: '暗角',
    tip: '拍摄均匀照明的平场白墙或漫射板（适当失焦、切勿过曝），计算边角相对照度衰减。',
  },
  {
    id: 'grid',
    label: '畸变',
    tip: '拍满横竖规则网格阵列，覆盖画面外侧边缘，定量拟合几何畸变系数。',
  },
];
const value = (v: number | null, digits = 3) =>
  v === null ? '待补样张' : v.toFixed(digits);
export const mtfLabel = (v: number | null) =>
  v === null
    ? '未找到有效边缘'
    : v >= 0.25
      ? '局部解像力极高'
      : v >= 0.16
        ? '局部解像力良好'
        : v >= 0.1
          ? '局部对比度偏柔'
          : '建议复查焦点';
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
        <h3>测试项目</h3>
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
              <span className="tag">{count} / 9 区域已测</span>
            </div>
            <div className="metric-grid">
              <div>
                <span>中心 MTF50 (cycles/px)</span>
                <strong>{value(lens.centerMtf50)}</strong>
                <small>{mtfLabel(lens.centerMtf50)}</small>
              </div>
              <div>
                <span>同方向边缘中位数 (MTF50)</span>
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
              数值单位 cycles/pixel（空间频率），数值越高表示对细节的传递能力越强。点击对应区域可查看高阶 ESF/LSF 响应曲线。
            </p>
            {!count && (
              <div className="inline-help">
                <p>
                  当前照片未自动匹配到合格的直斜边轮廓（不影响照片基础画质评价）。如需精准测算镜头 MTF 曲线，可使用练习标靶测试。
                </p>
                <button onClick={() => onDemo('detail')}>体验解析力测量</button>
              </div>
            )}
            <details>
              <summary>镜头光学评价参考说明</summary>
              <p>
                在相同机身、焦距、光圈与无损后期条件下，对比相同位置与方向的 MTF 空间频率。中心高而边缘低常见于镜头相差衰减、景深不足或靶面未正对，建议多次对焦测试。
              </p>
            </details>
          </section>
          <section className="report-card">
            <h3>横向色散 / RGB 边缘错位</h3>
            <div className="single-value">
              {value(lens.caPx, 2)}
              {lens.caPx !== null && <small> px</small>}
            </div>
            <p>
              {lens.caPx === null
                ? '边缘区域未找到合格的中性轮廓。使用中性斜边靶可精准测算；有彩色物体不会计入色散。'
                : lens.caPx < 0.5
                  ? '测得 RGB 通道重心错位极小，边角高反差轮廓紫边/绿边控制优异。'
                  : lens.caPx < 1.2
                    ? '存在轻微通道错位，高反差边缘放大观察可能可见细微色边。'
                    : 'RGB 通道错位明显，建议开启镜头光学校正文件进行补偿。'}
            </p>
            <details>
              <summary>测量原理与标准</summary>
              <p>
                统计画面外侧中性边缘在切向方向上 R/G 与 B/G 的归一化边缘重心最大偏移值（单位：像素）。该项指标针对横向色散 (Lateral CA)，不受纵向轴向色散影响。
              </p>
            </details>
          </section>
          <section className="report-card supplementary">
            <h3>补齐其他光学指标</h3>
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
          <h3>暗角与相对照度</h3>
          <div className="single-value">
            {value(lens.flat?.falloffEv ?? null, 2)}
            {lens.flat?.valid && <small> EV</small>}
          </div>
          <p>
            {lens.flat?.valid
              ? lens.flat.falloffEv! < 0.4
                ? '边角照度衰减极轻，画面整体亮度分布非常均匀。'
                : lens.flat.falloffEv! < 1
                  ? '存在适度暗角衰减，在平场下可见轻微边角变暗。'
                  : '边角光致衰减较明显，可适当收小光圈或开启暗角补偿。'
              : '尚未测得有效的平场图像。'}
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
                7×7 网格为相对中心画面的照度衰减 (EV)；四角最大不对称度{' '}
                {lens.flat.asymmetryEv?.toFixed(2)}{' '}
                EV。
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
                已精准拟合 {lens.distortion.lines.length} 条网格直线。
                {Math.abs(lens.distortion.cornerDistortionPct!) < 1
                  ? '画面几何直线保持良好，未见明显形变。'
                  : '存在可见几何形变，建议配合镜头校正文件恢复直线性。'}
              </p>
              <details>
                <summary>畸变模型计算说明</summary>
                <p>
                  负值为桶形畸变 (Barrel)，正值为枕形畸变 (Pincushion)。采用归一化半对角线单参数 k₁ 径向模型拟合角点畸变率。
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
        <h3>测试标靶下载</h3>
        <p>
          测试镜头时建议使用固定机身与三脚架，保持照明光线稳定，每挡光圈重复拍摄 3–5 张以检验稳定性。
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
          标靶印刷清晰度与平整度也会影响最终测算结果；此矢量图为标准练习标靶。
        </small>
      </section>
    </>
  );
}

