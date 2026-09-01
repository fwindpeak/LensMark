# LensOptics 镜头成像质量评估与 MTF 分析系统技术文档与维护指南

## 1. 系统概述与设计理念

### 1.1 背景与定位
传统 MTF 测量工具（如单一斜边测量器）对测试环境要求极高：必须精确拍摄 ISO 12233 标准标板，用户需在画面中反复微调选区，且经常由于倾角不合适或边缘模糊导致“未检出斜边”而无法获得任何分析结果。

**LensOptics** 对此进行了重构与升级：
- **默认支持任意实拍照片**（风景、人像、静物、街拍、星空、标板等），无需用户强制画框；
- **一键输出镜头综合光学素质评分与定级**（S / A / B / C / D）；
- **全图清晰度分布热力图 (Heatmap)**：空间锐度与微反差直观可视化；
- **9 像场解析力矩阵与边角衰减率**：中心锐度 vs 4 边角画质衰减一目了然；
- **色散紫边 (CA) 与暗角 (Vignetting) 自动量化**；
- **智能光学诊断与实拍建议**：提供光圈收缩档位与构图后期指导；
- **双模式无缝切换**：保留完整的 ISO 12233 斜边 4x 超采样 MTF / ESF / LSF 精细测量，并支持画面斜边自动扫描与一键聚焦。

---

## 2. 核心算法原理与数学公式

### 2.1 全图高频清晰度热力图与微块评估 (Tenengrad + Laplacian)
在全图网格化（默认 $24 \times 24$ 微块，子像素降采样保证毫秒级响应）中，综合结合一阶梯度能量与二阶高频纹理响应：

1. **Sobel 梯度算子 (Tenengrad 能量)**：
   $$\nabla_x = I * K_x, \quad \nabla_y = I * K_y$$
   $$G(x, y) = \sqrt{\nabla_x(x,y)^2 + \nabla_y(x,y)^2}$$
   仅对反差阈值 $G(x,y) > 6$ 的有效边缘积分平方均值：
   $$E_{tenen} = \frac{1}{N} \sum_{G > 6} G(x,y)^2$$

2. **Laplacian 离散二阶微分 (空间高频方差)**：
   $$L(x, y) = |4I(x,y) - I(x-1,y) - I(x+1,y) - I(x,y-1) - I(x,y+1)|$$
   $$E_{lap} = \frac{1}{N} \sum L(x, y)$$

3. **综合微块高频得分**：
   $$Sharp_{block} = \sqrt{E_{tenen}} \times 0.7 + E_{lap} \times 0.3$$

4. **Turbo / Jet 科学色彩热力图映射**：
   将归一化后的 $[0.0, 1.0]$ 空间锐度值映射至暗蓝 $\to$ 青 $\to$ 绿 $\to$ 黄 $\to$ 鲜红阶梯，直接在画布上以半透明平滑图层叠加显示。

---

### 2.2 9 像场分区矩阵与边角画质衰减率 (Field Zone Falloff)
光学系统由于场曲（Field Curvature）、彗差（Coma）与像散（Astigmatism），边缘画质往往低于中心。

- **像场划分**：
  - **中心像场 (Center)**：像场中央 $0 \sim 30\%$ 区域（主光轴附近）；
  - **四角像场 (Top-Left, Top-Right, Bottom-Left, Bottom-Right)**：像场 $70\% \sim 100\%$ 边缘；
  - **四边像场 (Top, Bottom, Left, Right)**：像场过渡区域。

- **边角画质衰减率计算**：
  $$Falloff\% = \max\left(0, \frac{Sharp_{center} - \overline{Sharp_{corners}}}{Sharp_{center}} \times 100\%\right)$$
  - $< 20\%$：像场极其平坦，全开可用；
  - $20\% \sim 35\%$：符合常规大光圈定焦镜头的正常衰减；
  - $> 40\%$：边角明显软化，建议收缩 $1 \sim 2$ 档光圈改善。

---

### 2.3 色散 (CA) 与紫边量化 (Chromatic Aberration)
垂轴色差（Lateral CA）表现为画面边缘高反差物体两侧红/蓝通道相对绿通道的子像素错位：
1. **通道重心偏移**：在全图高反差边缘处计算 $R, G, B$ 通道的亚像素偏导：
   $$\Delta_{RB} = \frac{\left|\frac{\partial R}{\partial x} - \frac{\partial B}{\partial x}\right|}{\left|\frac{\partial G}{\partial x}\right| + \epsilon}$$
2. **紫边判定**：当局部 $R$ 与 $B$ 亮度同时显著高于 $G$ 通道（$R > G+30 \land B > G+30$）且处于高对比边界时计入紫边比例。

---

### 2.4 暗角与相对照度 (Vignetting & EV Loss)
1. **相对照度计算**：
   $$Illum_{relative}\% = \frac{\overline{Luminance_{corners}}}{\overline{Luminance_{center}}} \times 100\%$$
2. **曝光级数衰减 (EV Loss)**：
   $$\Delta EV = \left| \log_2 \left( \frac{Illum_{relative}}{100} \right) \right|$$

---

### 2.5 ISO 12233 斜边 MTF / SFR 测量管线
当切换至专业斜边模式时，执行严密的 ISO 12233 测量流程：
1. **sRGB 物理光强反 Gamma 线性化**：
   $$L(V) = \begin{cases} \frac{V}{12.92}, & V \le 0.04045 \\ \left(\frac{V+0.055}{1.055}\right)^{2.4}, & V > 0.04045 \end{cases}$$
2. **亚像素边缘导数质心提取与最小二乘拟合**：
   $$x_{centroid} = \frac{\sum x \cdot |\nabla I(x)|}{\sum |\nabla I(x)|} \implies x = k \cdot y + b$$
3. **4x 超采样 ESF (Edge Spread Function)**：将每行像素根据拟合直线投影折叠至 4 倍密度的空间网格。
4. **汉宁窗差分 LSF (Line Spread Function)**：
   $$LSF[n] = \frac{ESF[n+1] - ESF[n-1]}{2} \cdot w_{Hanning}[n]$$
5. **DFT 频域解算与 MTF50 定位**：通过离散傅里叶变换计算频域调制幅度并归一化至 DC=1.0，插值求解 MTF 降至 50% 时的空间频率（cycles/pixel）。

---

## 3. 代码架构与模块索引

```
src/
├── core/                       # 核心数学与光学算法层
│   ├── lensQuality.ts          # 全图镜头素质分析（评分、热力图、9像场、色散、暗角、诊断）
│   ├── autoEdgeDetector.ts     # 画面高反差倾斜边缘多尺度自动扫描与去重
│   ├── sampleImages.ts         # 预设样张生成器（ISO标板、大光圈模拟、广角风光等）
│   ├── grayscale.ts            # 物理光强线性化与灰度转换
│   ├── edgeDetection.ts        # 斜边亚像素质心提取与自适应水平/垂直直线拟合
│   ├── esfLsf.ts               # 4x 超采样 ESF 折叠构建与汉宁窗 LSF
│   ├── dft.ts                  # 快速离散傅里叶变换与 MTF50 计算
│   └── index.ts                # 统一导出
├── components/                 # React UI 组件层
│   ├── Header.tsx              # 顶栏（模式切换器、预设样张选择、照片上传、指南弹窗）
│   ├── ImageWorkspace.tsx      # 主图像视口（Canvas 渲染、热力图 Overlay、斜边标记、ROI 选区）
│   ├── LensOverviewPanel.tsx   # 镜头综合素质评估面板（评分、4大指标、9宫格矩阵、诊断建议）
│   ├── MetricsCards.tsx        # 斜边模式 MTF50 指标卡
│   ├── GuideSection.tsx        # 算法原理与使用指南弹窗
│   └── Charts/                 # 可视化图表
│       ├── MtfChart.tsx        # MTF 调制传递函数曲线图
│       └── EsfLsfChart.tsx     # ESF 边缘扩散与 LSF 线扩散空间域图
├── types/
│   └── mtf.ts                  # 全局 TypeScript 接口定义
└── App.tsx                     # 根组件（状态流转与双模式调度）
```

---

## 4. 维护与二次开发指南

### 4.1 如何调整镜头综合评分权重
若需针对特定场景（如人像镜头或显微镜头）调整综合评分权重，可直接修改 [src/core/lensQuality.ts](file:///Users/guokai/code/my-opensource/mtf-analyzer/src/core/lensQuality.ts) 中的第 335~345 行：
```typescript
// 当前权重：中心锐度 40% + 边角衰减控制 30% + 色散表现 15% + 暗角照度 15%
const overallScore = Math.round(
  centerSharpness * 0.40 +
  falloffScore * 0.30 +
  caScore * 0.15 +
  vigScore * 0.15
);
```

### 4.2 如何扩展 EXIF 拍摄参数读取
若希望在导入照片时自动解析光圈 (F-Number)、焦距 (Focal Length)、ISO 与快门速度：
1. 安装 `exifreader` 或 `exifr`：
   ```bash
   bun add exifr
   ```
2. 在 `handleFileUpload` 中读取 `file` 对应 ArrayBuffer 的 EXIF 元数据，并透传给 `LensOverviewPanel` 展示与加入诊断规则。

### 4.3 构建与测试
```bash
# 启动本地开发热更新服务
bun dev

# TypeScript 类型检查与生产打包
bun run build
```
