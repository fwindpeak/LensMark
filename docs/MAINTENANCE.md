# 镜头光学成像质量与 MTF 分析系统维护指南 (Maintenance Guide)

本文档面向后续维护人员，详细说明系统的常见调优参数、新增指标扩展方法、构建与测试流程以及常见问题排查。

---

## 1. 快速开始与开发命令

项目基于 Vite + React + TypeScript 构建，运行环境推荐使用 Bun 或 Node.js (>= 18)。

```bash
# 启动本地开发服务 (支持 HMR 热更新)
bun dev
# 或
npm run dev

# 生产环境类型检查与打包构建
bun run build
# 或
npm run build

# 预览生产打包产物
bun run preview
```

---

## 2. 核心算法参数调优指南

所有算法核心均位于 `src/core/` 目录下，均为纯 TypeScript 无外部依赖实现。

### 2.1 画质评分权重调优 (`src/core/lensQuality.ts`)
在 `analyzeLensQuality()` 函数中，综合评分由四部分加权计算：
```typescript
// 权重可根据评测标准调整:
const overallScore = Math.round(
  centerSharpness * 0.40 +       // 中心锐度贡献 40%
  falloffScore * 0.30 +          // 边角衰减控制贡献 30%
  caScore * 0.15 +               // 色散表现贡献 15%
  vigScore * 0.15                // 暗角控制贡献 15%
);
```

### 2.2 热力图分辨率与灵敏度调优 (`src/core/lensQuality.ts`)
- **网格精度**：默认 `gridCols = 24`, `gridRows = 24`（共 576 个微块）。若需更高空间分辨率，可调大至 `32` 或 `48`。
- **Sobel 噪点过滤阈值**：`if (gVal > 6)`，可避免画面平坦低噪区域被误判为微纹理。

### 2.3 斜边自动探测灵敏度 (`src/core/autoEdgeDetector.ts`)
- **候选网格**：默认以 $5 \times 5$ 分区采样候选窗口。
- **角度有效区间**：默认 `fitted.angleDeg >= 2 && fitted.angleDeg <= 35`。
- **对比度门限**：`fitted.contrast >= 0.12`，过滤低反差杂乱纹理。
- 若在较暗照片中漏检斜边，可适当调低对比度门限（如降至 `0.08`）。

---

## 3. 如何扩展新的评测指标？

### 示例：新增「画面噪点与信噪比估算 (SNR / Noise)」
1. **修改类型定义 (`src/types/mtf.ts`)**：
   ```typescript
   export interface LensQualityResult {
     // ... 现有字段
     snrDb: number; // 信噪比 (dB)
     noiseLevel: '低' | '中等' | '较高';
   }
   ```
2. **在算法中实现 (`src/core/lensQuality.ts`)**：
   在平坦区域（梯度极低处）计算灰度标准差 $\sigma$，并计算 $\text{SNR} = 20 \log_{10}(\mu / \sigma)$。
3. **在 UI 面板中展示 (`src/components/LensQualityDashboard.tsx`)**：
   在指标网格中添加对应的 SNR 统计卡片。

---

## 4. 常见问题与排查 (Troubleshooting)

### Q1: 用户上传极高像素照片（如 4800 万~6000 万像素）时是否会卡顿？
- **机制保障**：`analyzeLensQuality()` 在进行全图热力图与分区扫描时，会自动将内存分析画布限制在长边 `1200px` 内进行等比下采样；而在执行 ISO 12233 局部斜边计算时，会按原图真实物理像素精确裁剪 ROI。这样兼顾了全图分析的毫秒级实时性与局部 MTF 的亚像素精度。

### Q2: 为什么手动框选某些区域仍显示“未检出有效斜边”？
- **排查原因**：
  1. 选区内完全是纯色或杂乱无方向纹理；
  2. 选区过小（需 $\ge 10 \times 10$ 像素）；
  3. 边缘反差极低（明暗差异 $< 10\%$）。
- **建议操作**：直接切换到「全图画质诊断」模式（实拍照片无需斜边），或在标板模式下直接点击自动检测出的**智能斜边徽章**。

---

## 5. 代码质量与发布规范
- 修改代码后务必运行 `bun run build` 确保 TypeScript 严格模式类型检查 100% 通过。
- 保持 `src/core/` 算法层与 DOM / UI 框架解耦，便于未来将算法打包为 Web Worker 或 npm 纯算法库。
