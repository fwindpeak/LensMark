import { useEffect, useRef, useState } from 'react';
import type { EvaluationRecord } from '../types/assessment';
import { downloadText } from '../core/comparison';
import {
  evaluationsCsv,
  lensComparisonIssues,
  parseRecords,
  repeatSummary,
  zoneComparison,
} from '../core/evaluationRecords';
import { ZONE_NAMES } from '../core/lensAssessment';

function RecordEditor({
  record,
  onSave,
}: {
  record: EvaluationRecord;
  onSave: (record: EvaluationRecord) => void;
}) {
  const [draft, setDraft] = useState(record);
  return (
    <form
      className="metadata-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      {(['camera', 'lens'] as const).map((k) => (
        <label key={k}>
          {k === 'camera' ? '机身' : '镜头'}
          <input
            maxLength={200}
            value={draft[k]}
            onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
          />
        </label>
      ))}
      {(['aperture', 'focalLength', 'iso'] as const).map((k) => (
        <label key={k}>
          {{ aperture: '光圈 f/', focalLength: '焦距 mm', iso: 'ISO' }[k]}
          <input
            type="number"
            min=".1"
            max={k === 'iso' ? 1000000 : 5000}
            step="any"
            value={draft[k] ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                [k]: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
      <button className="primary" type="submit">
        保存参数
      </button>
    </form>
  );
}
export function ComparisonPanel({
  records,
  onRemove,
  onUpdate,
  onImport,
}: {
  records: EvaluationRecord[];
  onRemove: (id: string) => void;
  onUpdate: (record: EvaluationRecord) => void;
  onImport: (records: EvaluationRecord[]) => void;
}) {
  const [kind, setKind] = useState<'photo' | 'lens'>('photo');
  const [compare, setCompare] = useState<'lenses' | 'apertures'>('lenses');
  const [baseId, setBaseId] = useState(records[0]?.id ?? ''),
    [zone, setZone] = useState('4');
  const [confirmed, setConfirmed] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const baseline = records.find((r) => r.id === baseId) ?? records[0];
  const signature = records
    .map((r) =>
      [r.id, r.camera, r.lens, r.aperture, r.focalLength, r.iso, r.scene].join(
        ':',
      ),
    )
    .join('|');
  useEffect(() => setConfirmed(false), [signature, baseId, compare]);
  const repeats = confirmed ? repeatSummary(records, zone) : [];
  return (
    <section className="records-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">对比与记录</div>
          <h2>让差异看得见</h2>
          <p>
            上传后自动保存报告与小预览，不保存原照片。最多 50
            份，仅保存在当前浏览器。
          </p>
        </div>
        <div className="button-row">
          <button
            disabled={!records.length}
            onClick={() =>
              downloadText(
                'LensMark-comparison.csv',
                evaluationsCsv(records),
                'text/csv;charset=utf-8',
              )
            }
          >
            导出 CSV
          </button>
          <button
            disabled={!records.length}
            onClick={() =>
              downloadText(
                'LensMark-records.json',
                JSON.stringify({ version: 3, records }, null, 2),
              )
            }
          >
            备份 JSON
          </button>
          <button onClick={() => file.current?.click()}>导入记录</button>
          <input
            ref={file}
            type="file"
            hidden
            accept=".json,application/json"
            onChange={async (e) => {
              const selected = e.target.files?.[0];
              e.target.value = '';
              if (!selected) return;
              if (selected.size > 8 * 1024 * 1024) {
                setMessage('记录文件超过 8 MB');
                return;
              }
              try {
                const imported = parseRecords(await selected.text());
                if (!imported.length)
                  setMessage('文件中没有有效记录，现有记录未改变。');
                else {
                  onImport(imported);
                  setMessage('已导入 ' + imported.length + ' 份记录');
                }
              } catch {
                setMessage('文件读取失败，现有记录未改变。');
              }
            }}
          />
        </div>
      </div>
      {message && <p role="status">{message}</p>}
      {!records.length ? (
        <div className="empty-note">
          <h3>先上传一组照片</h3>
          <p>可一次选择多张。照片评价无需标板；比较镜头请使用同条件样张。</p>
        </div>
      ) : (
        <>
          <div className="comparison-toolbar">
            <div className="segmented">
              <button
                aria-pressed={kind === 'photo'}
                onClick={() => setKind('photo')}
              >
                比较照片
              </button>
              <button
                aria-pressed={kind === 'lens'}
                onClick={() => setKind('lens')}
              >
                比较镜头 / 光圈
              </button>
            </div>
            <label>
              基准照片
              <select
                value={baseline.id}
                onChange={(e) => setBaseId(e.target.value)}
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fileName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kind === 'lens' && (
            <div className="comparison-conditions">
              <label>
                比较方式
                <select
                  value={compare}
                  onChange={(e) =>
                    setCompare(e.target.value as 'lenses' | 'apertures')
                  }
                >
                  <option value="lenses">不同镜头 · 相同光圈</option>
                  <option value="apertures">同一镜头 · 不同光圈</option>
                </select>
              </label>
              <label>
                解析力位置
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  {ZONE_NAMES.map((name, i) => (
                    <option value={String(i)} key={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                已确认同一目标、比例、光照和后期，且检查了对焦与抖动。
              </label>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>照片 / 镜头</th>
                  {kind === 'photo' ? (
                    <>
                      <th>技术参考分</th>
                      <th>清晰轮廓</th>
                      <th>噪声 σ</th>
                      <th>高光截断</th>
                    </>
                  ) : (
                    <>
                      <th>MTF50 / 差值</th>
                      <th>RGB 错位</th>
                      <th>暗角</th>
                      <th>畸变</th>
                    </>
                  )}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const issues =
                    kind === 'lens'
                      ? lensComparisonIssues(baseline, r, compare)
                      : [];
                  const comparison = zoneComparison(baseline, r, zone);
                  const allowed = confirmed && !issues.length;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="record-identity">
                          {r.thumbnail && (
                            <img
                              src={r.thumbnail}
                              alt=""
                              width="68"
                              height="48"
                            />
                          )}
                          <div>
                            <b>{r.fileName}</b>
                            <small>
                              {r.camera || '机身未填写'} ·{' '}
                              {r.lens || '镜头未填写'}
                            </small>
                            <small>
                              f/{r.aperture ?? '?'} · {r.focalLength ?? '?'} mm
                              · ISO {r.iso ?? '?'}
                              {r.source === 'synthetic' ? ' · 合成演示' : ''}
                            </small>
                          </div>
                        </div>
                        {editing === r.id && (
                          <RecordEditor
                            key={r.id}
                            record={r}
                            onSave={(updated) => {
                              onUpdate(updated);
                              setEditing(null);
                            }}
                          />
                        )}
                      </td>
                      {kind === 'photo' ? (
                        <>
                          <td>
                            <strong>{r.photoScore ?? '—'}</strong>
                            <small>
                              已测权重 {Math.round(r.scoreCoverage * 100)}%
                            </small>
                          </td>
                          <td>
                            {r.sharpnessPx?.toFixed(1) ?? '—'}
                            <small>px · 越窄越清晰</small>
                          </td>
                          <td>{r.noiseSigma?.toFixed(2) ?? '—'}</td>
                          <td>
                            {r.highlightsPct === null
                              ? '—'
                              : r.highlightsPct.toFixed(1) + '%'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <strong>
                              {r.zones
                                .find((z) => z.id === zone)
                                ?.mtf50?.toFixed(3) ?? '—'}
                            </strong>
                            <small>
                              {r.id === baseline.id
                                ? '基准 · cycles/pixel'
                                : !allowed
                                  ? issues.join('；') || '请确认拍摄条件'
                                  : comparison.delta === null
                                    ? comparison.reason
                                    : (comparison.delta >= 0 ? '+' : '') +
                                      comparison.delta.toFixed(1) +
                                      '% · ' +
                                      (Math.abs(comparison.delta) < 5
                                        ? '差异较小'
                                        : comparison.delta > 0
                                          ? '此处解析更强'
                                          : '此处解析较弱')}
                            </small>
                          </td>
                          <td>
                            {r.caPx?.toFixed(2) ?? '—'}
                            <small>px</small>
                          </td>
                          <td>
                            {r.falloffEv?.toFixed(2) ?? '—'}
                            <small>EV</small>
                          </td>
                          <td>
                            {r.distortionPct?.toFixed(2) ?? '—'}
                            <small>%</small>
                          </td>
                        </>
                      )}
                      <td>
                        <button
                          onClick={() =>
                            setEditing(editing === r.id ? null : r.id)
                          }
                        >
                          编辑参数
                        </button>
                        <button
                          className="quiet"
                          aria-label={'删除记录 ' + r.fileName}
                          onClick={() => onRemove(r.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {repeats.length > 0 && (
            <section className="report-card">
              <h3>{ZONE_NAMES[Number(zone)]} · 重复测量稳定性</h3>
              {repeats.map((g, i) => (
                <p key={i}>
                  {g.label}：{g.count} 张，中位数 {g.median.toFixed(3)}，极差{' '}
                  {g.rangePct.toFixed(1)}%。
                  {g.rangePct > 10
                    ? '波动较大，建议检查对焦或重新拍摄。'
                    : '本组测量较稳定。'}
                </p>
              ))}
            </section>
          )}
          <p className="muted">
            {kind === 'photo'
              ? '照片参考分只适合同场景、同尺寸下辅助挑片；主题与审美仍由你判断。'
              : '差值只针对选定位置和方向。色差、暗角和畸变列展示实测值，不跨测试类型自动排名；“—”表示该记录没有该项测量。'}
          </p>
        </>
      )}
    </section>
  );
}
