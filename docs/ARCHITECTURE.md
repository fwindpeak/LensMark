# 当前架构

## 数据流程

上传/合成样张 → 解码与 EXIF → AnalysisClient → Worker 中的 AnalysisEngine → 照片评价 + 镜头测量 → 展示/本地报告/比较。

- `App.tsx`：单图/批量队列、照片身份与任务版本、取消和超时、自动保存、模式切换。迟到的任务不得覆盖新图。主体复查不覆盖全图比较分数。
- `analysisClient.ts`：Worker 生命周期、请求隔离、超时/失败恢复；缺少 Worker 或 OffscreenCanvas 时以本地 Canvas 运行同一引擎。
- `analysisEngine.ts`：缓存概览、原像素清晰度/噪声采样和多区斜边扫描；切换选区只重算局部数据。
- `photoQuality.ts`：曝光、去平面 MAD 噪声、原始主体统计。
- `photoAssessment.ts`：轮廓法向过渡宽度、分项判读、透明加权的技术参考分与建议。
- `lensAssessment.ts`：内容引导的候选检测、九区独立测量、同方向归组；不按清晰度挑选最高结果，展示样本中位数。
- `optics.ts`：中性 RGB 边缘错位、平场相对照度与径向畸变拟合。
- `mtf.ts / edgeDetection.ts / esfLsf.ts / dft.ts`：局部 SFR 流程，保留带符号 LSF 与 Nyquist 限制。
- `demoImages.ts`：确定性像素输入、可打印 SVG 靶。演示结果必须经真实引擎计算。
- `rawDecoder.ts / cancellation.ts`：带中止信号的 LibRaw 解码、PNG 显示图与明确标记的预览回退。取消不会继续启动回退解码。
- `evaluationRecords.ts`：新旧记录迁移/校验、元数据兼容、方向/位置检查、重复测量、CSV 防公式注入。
- `components`：照片、镜头、对比三个入口；专业曲线和输入折叠。保留 EXIF 弹窗。

旧 `lensPerformance.ts` / `comparison.ts` 的旧数据接口仅用于兼容和原有回归；新 UI 使用 `LensAssessment` 与 `EvaluationRecord`。不要把旧接口的空值占位重新接回用户主流程。

## 资源与隐私

- 全图仅做最多 1280 px 曝光概览和 960 px 镜头/轮廓定位概览；清晰度、噪声和 MTF 在原像素裁剪上计算。
- 批量最多 12 张，顺序处理，不同时保留十二份全分辨率位图。
- 新图片替换旧 Worker，旧位图关闭；Blob URL 释放。
- 文件最大 200 MB，解码图最大 1 亿像素，读取/解码 60 秒、分析 45 秒超时。
- 本地最多 50 份报告与 240 px 缩略图；不保存完整 EXIF/GPS，不上传照片。JSON/CSV 不含完整 EXIF；用户主动从 EXIF 弹窗导出的信息除外。
- 表格删除可撤销一条；JSON 恢复按 ID 去重；异常或不安全记录不会进入 UI。
