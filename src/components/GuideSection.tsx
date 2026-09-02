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
        <h2>如何拍摄合格的标准测试样张？</h2>
        <button onClick={onClose} aria-label="关闭拍摄指南">
          关闭
        </button>
      </div>
      <p>
        日常实拍照片适合快速评估成片表现；若需严谨横评对比不同镜头，需确保相机机身、照明光环境、焦点位置及无损图像后处理流程高度一致。
      </p>
      <ol>
        <li>
          <b>固定机身与基准场景：</b>
          使用稳固三脚架与静止标靶，确保曝光光照一致，保持相机轴线与标靶垂直正对。
        </li>
        <li>
          <b>拍摄无剪切的阶跃斜边：</b>使用中性灰/黑阶跃斜边（推荐 5° 倾角），注意边缘两侧勿发生像素过曝高光剪切。
        </li>
        <li>
          <b>中心与九区边缘分别覆盖：</b>
          将标靶布局覆盖画面中心及四周角落，单区域测算无法外推全画场响应。
        </li>
        <li>
          <b>每挡光圈多次重复测量：</b>重新对焦拍摄 3–5 张以提取中位数与统计分布，避免单一对焦误差干扰评测。
        </li>
        <li>
          <b>统一 RAW 解码与后期控制：</b>
          保持相同的输出尺寸、锐化强度与机内光学校正开关；RAW 内嵌缩略图不适用于原像素对比。
        </li>
      </ol>
      <h3>不同光学维度样张规范</h3>
      <table>
        <thead>
          <tr>
            <th>测试项目</th>
            <th>拍摄规范与操作要点</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>照片质量评估</td>
            <td>
              直接上传原图照片，系统自动检测像素清晰度、曝光动态范围与纯净度 SNR，点击主体可单独检验。
            </td>
          </tr>
          <tr>
            <td>解像力 / 横向色散</td>
            <td>
              正对平整斜边标靶，确保中性阶跃边缘不过曝。镜头页自动识别 9 区 MTF50 与 RGB 色散重心偏移。
            </td>
          </tr>
          <tr>
            <td>暗角 / 相对照度</td>
            <td>
              拍摄均匀照明的平场背景（白墙或漫射板），适当失焦并切勿过曝，测算边角对中心照度的衰减。
            </td>
          </tr>
          <tr>
            <td>几何畸变</td>
            <td>
              拍满规则网格阵列（覆盖画面外侧边缘），自动追踪网格线并拟合径向畸变系数。
            </td>
          </tr>
        </tbody>
      </table>
      <h3>多图横评与对比说明</h3>
      <p>
        单次支持批量上传最多 12 张照片，测试报告自动在本地持久化。在对比面板中可补齐相机、镜头及光圈参数，支持同光圈不同镜头、同一镜头不同光圈的差值对照。
      </p>
      <p className="muted">
        注：本工具旨在提供轻量、便捷的客观像素分析，非 ISO 12233 官方认证标定软件。合成样张仅供功能演示体验。
      </p>
    </dialog>
  );
}

