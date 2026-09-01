
import { useEffect, useRef } from 'react';
export function GuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (isOpen) dialog.current?.showModal(); else dialog.current?.close(); }, [isOpen]);
  return <dialog ref={dialog} onCancel={onClose} className="guide-dialog"><div className="section-heading"><h2>怎么拍，才能比较镜头？</h2><button onClick={onClose} aria-label="关闭拍摄指南">关闭</button></div>
    <p>随手拍适合检查成片表现。比较镜头，需要让机身、场景、对焦和处理流程尽量一致。</p>
    <ol><li><b>固定机身与场景。</b>三脚架、静止平面目标、稳定光照，保持相同拍摄比例和目标位置。</li><li><b>拍摄未截断的斜边。</b>中性灰黑两侧，约 5° 倾角；不要把纯黑或过曝白块当作可靠阶跃。</li><li><b>中心与四角分别测量。</b>同一平面上布置标靶；单个选区无法推算其他像场。</li><li><b>每个光圈重复拍摄。</b>重新对焦拍 3–5 张，记录中位数与波动；不要只挑最锐的一张。</li><li><b>固定解码与后期。</b>相同尺寸、白平衡、锐化和降噪，记录镜头校正状态；RAW 内嵌预览不适合原像素对比。</li></ol>
    <h3>不同维度需要不同照片</h3><table><thead><tr><th>目的</th><th>需要拍摄</th></tr></thead><tbody><tr><td>噪声</td><td>含中间调均匀灰面的照片</td></tr><tr><td>局部系统 MTF</td><td>平整、清晰、未截断的斜边靶</td></tr><tr><td>光学暗角</td><td>均匀照明平场 + 线性数据（当前未实现）</td></tr><tr><td>色差 / 畸变</td><td>中性边缘 / 几何网格（当前未实现定量）</td></tr></tbody></table>
    <p className="muted">本工具不是经认证的 ISO 12233 测量软件。合成演示只用于理解操作，不提供镜头评级。</p>
  </dialog>;
}
