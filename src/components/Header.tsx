
import { useRef } from 'react';
import type { AnalysisMode } from '../types/mtf';
import { SAMPLE_PRESETS } from '../core/sampleImages';
import type { SamplePreset } from '../core/sampleImages';
const modes: [AnalysisMode, string][] = [['photo_quality', '照片检查'], ['lens_performance', '镜头证据'], ['slanted_edge', '局部 MTF'], ['overview', '测量记录']];
export function Header({ mode, onModeChange, onFileUpload, onSelectSample, onToggleGuide }: {
  mode: AnalysisMode; onModeChange: (m: AnalysisMode) => void; onFileUpload: (f: File) => void;
  onSelectSample: (p: SamplePreset) => void; onToggleGuide: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <header className="app-header"><div className="brand"><span className="brand-icon">L</span><div><h1>LensMark</h1><p>照片检查 · 镜头成像特征测量</p></div></div>
    <div className="header-actions"><button onClick={onToggleGuide}>拍摄指南</button><select aria-label="合成演示" value="" onChange={e => { const p = SAMPLE_PRESETS.find(p => p.id === e.target.value); if (p) onSelectSample(p); }}><option value="">试用合成演示</option>{SAMPLE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="primary" onClick={() => input.current?.click()}>导入照片</button><input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif,image/bmp,.arw,.cr2,.cr3,.nef,.nrw,.dng,.raf,.orf,.rw2,.pef,.srw,.3fr,.mef,.mrw,.raw" onChange={e => { const f = e.target.files?.[0]; if (f) onFileUpload(f); e.target.value = ''; }} /></div>
    <nav aria-label="分析功能">{modes.map(([id, label]) => <button key={id} aria-current={id === mode ? 'page' : undefined} onClick={() => onModeChange(id)}>{label}</button>)}</nav>
  </header>;
}
