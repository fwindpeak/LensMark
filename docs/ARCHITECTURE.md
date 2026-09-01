
# 当前架构

- App.tsx：文件/演示加载、来源标记、任务版本、错误处理、记录与导出。每次换图终止旧分析 Worker；迟到的解码结果和旧任务结果不能覆盖新图。
- analysis.worker.ts：持有 ImageBitmap 和全图分析缓存。首次计算曝光、九处噪声、主体统计和候选斜边；后续 ROI 修改只重新计算主体与局部 MTF。替换图片时关闭旧位图。
- pixels.ts：OffscreenCanvas 原像素裁剪、ROI 边界、透明通道白底合成和 sRGB 逆变换。
- photoQuality.ts：曝光、去平面残差噪声和主体纹理统计。
- mtf.ts / edgeDetection.ts / esfLsf.ts / dft.ts：局部斜边筛查与频率响应。
- lensPerformance.ts：只展示可追溯测量和未确认条件，不生成光学总分。
- rawDecoder.ts：LibRaw 去马赛克成片或内嵌 JPEG 预览，返回明确的 sourceKind。采用固定亮度参数、sRGB 曲线、无损 PNG 中间图。
- comparison.ts：参数兼容检查和 CSV 导出；文件名进行 CSV 引号转义及公式前缀处理。
- components：照片检查、镜头证据、局部 MTF 和记录表。ImageWorkspace 支持鼠标/触摸选区、坐标输入与 100% 裁剪查看。

照片不存入 localStorage，仅保存最多 50 条精简测量记录，不包含完整 EXIF/GPS。JSON 报告不包含完整 EXIF。EXIF 弹窗维持原有查看与单独导出功能。
