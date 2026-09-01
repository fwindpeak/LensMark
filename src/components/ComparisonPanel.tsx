
import { useState } from 'react';
import type { MeasurementRecord } from '../types/evaluation';
import { comparisonIssues, downloadText, recordsToCsv } from '../core/comparison';
export function ComparisonPanel({ records, onRemove }: { records: MeasurementRecord[]; onRemove: (id: string) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return <section className="report-card"><div className="eyebrow">同条件比较</div><h2>测量记录 · {records.length}</h2><p>在局部 MTF 页面保存记录，再导入另一张照片。记录保存在当前浏览器；不保存照片。</p>
    <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我已确认同一目标、拍摄比例、光照和处理流程，并检查了对焦与抖动。</label>
    {!records.length ? <p className="empty-note">还没有记录。先导入照片并测量一条有效斜边。</p> : <><button onClick={() => downloadText('LensMark-measurements.csv', recordsToCsv(records), 'text/csv;charset=utf-8')}>导出 CSV</button><div className="table-scroll"><table><thead><tr><th>照片 / 镜头</th><th>MTF50</th><th>参数</th><th>与首条相比</th><th /></tr></thead><tbody>{records.map((r, i) => {
      const issues = i ? comparisonIssues(records[0], r) : [];
      const canCompare = i > 0 && confirmed && issues.length === 0 && records[0].mtf50 !== null && records[0].mtf50 > 0 && r.mtf50 !== null;
      return <tr key={r.id}><td>{r.fileName}<small>{r.lens || '未知镜头'} · {r.camera || '未知机身'}</small></td><td>{r.mtf50?.toFixed(3) ?? '—'}<small>cycles/pixel</small></td><td>f/{r.aperture ?? '?'}<small>{r.focalLength ?? '?'} mm · ISO {r.iso ?? '?'}</small></td><td>{i === 0 ? '基准' : canCompare ? ((r.mtf50! / records[0].mtf50! - 1) * 100).toFixed(1) + '%（局部测量差）' : issues.length ? issues.join('；') : '请先确认拍摄条件'}</td><td><button aria-label={'删除记录 ' + r.fileName} onClick={() => onRemove(r.id)}>删除</button></td></tr>;
    })}</tbody></table></div></>}
    <p className="muted">参数相同不代表条件完全相同。差值只描述测量，不自动评判哪支镜头更好；建议重复测量并查看波动。</p>
  </section>;
}
