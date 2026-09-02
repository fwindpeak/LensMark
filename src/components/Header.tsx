import { useRef } from 'react';
import { Aperture, Upload, HelpCircle, Sun, Moon } from 'lucide-react';
import type { AnalysisMode } from '../types/mtf';
import { DEMOS } from '../core/demoImages';
import type { DemoKind } from '../core/demoImages';

export function Header({
  mode,
  onModeChange,
  onFiles,
  onDemo,
  onGuide,
  count,
  theme,
  onToggleTheme,
}: {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  onFiles: (files: File[]) => void;
  onDemo: (kind: DemoKind) => void;
  onGuide: () => void;
  count: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="LensMark 首页">
        <Aperture size={28} />
        <span>
          LensMark<small>光学性能与照片质量评估</small>
        </span>
      </a>
      <div className="header-actions">
        {onToggleTheme && (
          <button
            className="quiet"
            onClick={onToggleTheme}
            title={theme === 'light' ? '切换至深色模式' : '切换至浅色模式'}
            aria-label={theme === 'light' ? '切换至深色模式' : '切换至浅色模式'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? '深色' : '亮色'}</span>
          </button>
        )}
        <button className="quiet" onClick={onGuide}>
          <HelpCircle size={16} />
          拍摄指南
        </button>
        <select
          aria-label="试用合成样张"
          value=""
          onChange={(e) => onDemo(e.target.value as DemoKind)}
        >
          <option value="">试用样张</option>
          {DEMOS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => input.current?.click()}>
          <Upload size={16} />
          上传照片
        </button>
        <input
          ref={input}
          data-testid="file-input"
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/bmp,.arw,.cr2,.cr3,.nef,.nrw,.dng,.raf,.orf,.rw2,.pef,.srw,.3fr,.mef,.mrw,.raw"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>
      <nav aria-label="评估功能">
        {(
          [
            ['photo_quality', '照片评价'],
            ['lens_performance', '镜头评价'],
            ['overview', '照片对比 · ' + count],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-current={
              mode === id ||
              (id === 'lens_performance' && mode === 'slanted_edge')
                ? 'page'
                : undefined
            }
            onClick={() => onModeChange(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

