import { useEffect, useRef } from 'react';
export function GuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [isOpen]);
  return (
    <dialog ref={dialog} onCancel={onClose} className="guide-dialog">
      <div className="section-heading">
        <h2>怎么拍，才能比较镜头？</h2>
        <button onClick={onClose} aria-label="关闭拍摄指南">
          关闭
        </button>
      </div>
      <p>
        随手拍适合检查成片表现。比较镜头，需要让机身、场景、对焦和处理流程尽量一致。
      </p>
      <ol>
        <li>
          <b>固定机身与场景。</b>
          三脚架、静止平面目标、稳定光照，保持相同拍摄比例和目标位置。
        </li>
        <li>
          <b>拍摄未截断的斜边。</b>中性灰黑两侧，约 5°
          倾角；不要把纯黑或过曝白块当作可靠阶跃。
        </li>
        <li>
          <b>中心与四角分别测量。</b>
          同一平面上布置标靶；单个选区无法推算其他像场。
        </li>
        <li>
          <b>每个光圈重复拍摄。</b>重新对焦拍 3–5
          张，记录中位数与波动；不要只挑最锐的一张。
        </li>
        <li>
          <b>固定解码与后期。</b>
          相同尺寸、白平衡、锐化和降噪，记录镜头校正状态；RAW
          内嵌预览不适合原像素对比。
        </li>
      </ol>
      <h3>不同维度需要不同照片</h3>
      <table>
        <thead>
          <tr>
            <th>目的</th>
            <th>拍什么 / 怎么操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>照片评价</td>
            <td>
              直接上传普通原图，自动检查清晰度、曝光、噪点与层次。点击主体可单独复查。
            </td>
          </tr>
          <tr>
            <td>解析力 / 横向色差</td>
            <td>
              正对平面斜边靶，中性两侧不过曝，中心与边角均需覆盖。镜头页自动检测九区。
            </td>
          </tr>
          <tr>
            <td>暗角</td>
            <td>
              均匀照明平场，填满画面、稍微失焦。镜头页选择“暗角”，计算角落对中心的
              EV 衰减。
            </td>
          </tr>
          <tr>
            <td>畸变</td>
            <td>
              拍满横竖网格，线条覆盖外侧。选择“畸变”，自动追踪直线并拟合径向模型。
            </td>
          </tr>
        </tbody>
      </table>
      <h3>如何比较</h3>
      <p>
        一次上传最多 12
        张，报告自动保存。对比页可编辑机身、镜头和曝光参数，支持不同镜头同光圈、同镜头不同光圈。确认拍摄条件后选择中心或某个边角查看差值。连续多张测量可查看中位数与波动。
      </p>
      <p>
        照片技术参考分不用于跨题材或跨机身排名；镜头表现受传感器、对焦、锐化、降噪和机内镜头校正共同影响。场曲、散景、纵向色差、彗差和抗眩光需要专门的多张样本，不由本工具单图自动定量。
      </p>
      <p className="muted">
        本工具不是经认证的 ISO 12233
        测量软件。合成演示只用于理解操作，不提供镜头评级。
      </p>
    </dialog>
  );
}
