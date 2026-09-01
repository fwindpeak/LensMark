# LensMark 镜头光学成像质量与 MTF 分析系统架构文档 (Architecture Guide)

本文档详细记录了 **LensMark 镜头光学成像质量与 MTF 分析系统** 的架构设计、核心数据流、数学物理算法原理与工程模块分层，供后续维护与算法迭代参考。

---

## 1. 整体系统架构与数据流

系统采用双引擎驱动设计，既能为普通摄影实拍样张提供**零配置全图光学成像质量诊断**，也能为专业标板测试提供**自动高精度 ISO 12233 MTF50 空间频率解算**。

```mermaid
flowchart TD
    subgraph Input [输入层]
        IMG[用户导入实拍照 / 测试标板 / 合成样张]
    end

    subgraph CoreEngine [核心算法层 (src/core/)]
        LQ[全图镜头画质诊断引擎 lensQuality.ts]
        AD[智能斜边自动探测引擎 autoEdgeDetector.ts]
        ED[全方向斜边拟合引擎 edgeDetection.ts]
        EL[4x 超采样 ESF/LSF esfLsf.ts]
        DFT[DFT 频域解算与 MTF50 dft.ts]
    end

    subgraph OutputState [状态管理与结果]
        LQR[全图画质结果: 综合评分/九宫格/热力图/色散/暗角/诊断]
        EDG[候选斜边集: 中心与边角 Top 标定点]
        MTFR[ISO 12233 结果: MTF50/ESF/LSF/拟合斜率]
    end

    subgraph UILayer [UI 呈现层 (src/components/)]
        VW[ImageWorkspace: 热力图叠加 / 交互 ROI / 徽章点击]
        DASH[LensQualityDashboard: 综合卡片 / 九宫格 / 诊断报告]
        CHART[Charts: MTF 频域曲线 / ESF-LSF 空间域过渡]
    end

    IMG --> LQ & AD
    LQ --> LQR
    AD --> EDG
    EDG --> ED --> EL --> DFT --> MTFR
    LQR --> DASH & VW
    MTFR --> CHART
```

---

## 2. 核心数学与物理算法原理

### 2.1 全图镜头画质综合评估 (Blind Lens Quality Assessment)

#### (1) 微块空间锐度与热力图计算 (Spatial Sharpness Heatmap)
将图像划分为 $24 \times 24$ 的局部空间微块。对每个微块同时计算 Sobel 梯度能量与 Laplacian 纹理方差：
- **Modified Tenengrad 梯度能量**：
  $$G_x = \text{Sobel}_x(I), \quad G_y = \text{Sobel}_y(I)$$
  $$E_{\text{Tenen}} = \frac{1}{N} \sum_{\sqrt{G_x^2 + G_y^2} > T} (G_x^2 + G_y^2)$$
- **Laplacian 局部微反差**：
  $$E_{\text{Lap}} = \frac{1}{N} \sum |4 I(x, y) - I(x+1, y) - I(x-1, y) - I(x, y+1) - I(x, y-1)|$$
- **微块综合清晰度**：
  $$S_{\text{block}} = 0.7 \times \sqrt{E_{\text{Tenen}}} + 0.3 \times E_{\text{Lap}}$$
- 热力图经过 Min-Max 归一化后，映射至 Turbo/Jet 伪彩色谱（蓝 $\rightarrow$ 青 $\rightarrow$ 绿 $\rightarrow$ 黄 $\rightarrow$ 红）以 Canvas 图层形式动态平滑叠加在原图上方。

#### (2) 九宫格像场解析力分布与边缘衰减率 (Zone Sharpness & Edge Falloff)
- **像场区域划分**：
  - 中心区（Center）：画面中心半径 30% 核心光轴区域。
  - 四边角（Top-Left, Top-Right, Bottom-Left, Bottom-Right）：画面 70%~100% 边缘视场。
  - 四边缘（Top, Bottom, Left, Right）：过渡区域。
- **边缘画质衰减率 (Edge Falloff %)**：
  $$\text{Falloff Rate} = \max\left(0, \frac{S_{\text{center}} - \bar{S}_{\text{corners}}}{S_{\text{center}}}\right) \times 100\%$$
  - $< 15\%$：极佳（顶级定焦或高阶变焦）
  - $15\% \sim 30\%$：良好（主流大光圈全开）
  - $> 40\%$：衰减显著（边缘软化较重）

#### (3) 色散与紫边量化 (Chromatic Aberration)
- 沿高反差边缘（$\nabla G > 40$）提取 R、G、B 通道导数剖面。
- 计算 R-G 与 B-G 通道亚像素错位偏移 $\Delta_{\text{CA}} = \frac{|x_R - x_B|}{\nabla G}$。
- 统计紫边像素比例（$R > G + 30$ 且 $B > G + 30$），输出平均错位像素数、最大错位与等级评定。

#### (4) 暗角与光照均匀度 (Vignetting & Illumination)
- 计算中心区与四角边缘的低通平均亮度 $L_{\text{center}}$ 与 $L_{\text{corner}}$。
- 相对照度百分比：$RI = \frac{L_{\text{corner}}}{L_{\text{center}}} \times 100\%$。
- 边角曝光损失 EV：$\Delta EV = |\log_2(RI / 100)|$。

---

### 2.2 ISO 12233 斜边法 (Slanted-Edge MTF Pipeline)

#### (1) 物理光强线性化 (Linearization)
数码照片在存储时经过 sRGB Gamma 压缩（编码非线性）。算法首先应用逆变换：
$$I_{\text{linear}} = \begin{cases} \frac{I_{\text{srgb}}}{12.92}, & I_{\text{srgb}} \le 0.04045 \\ \left(\frac{I_{\text{srgb}} + 0.055}{1.055}\right)^{2.4}, & I_{\text{srgb}} > 0.04045 \end{cases}$$

#### (2) 全方向斜边自适应拟合 (Omni-Directional Edge Fitting)
- **近垂直斜边**（$3^\circ \sim 35^\circ$）：逐行求水平导数质心 $x_i = \frac{\sum x \cdot |\nabla_x|}{\sum |\nabla_x|}$，拟合 $x = k \cdot y + b$。
- **近水平斜边**（$75^\circ \sim 87^\circ$）：逐列求垂直导数质心 $y_i = \frac{\sum y \cdot |\nabla_y|}{\sum |\nabla_y|}$，拟合 $y = k \cdot x + b$。
- 自动比较拟合残差与对比度，选取最佳主轴方向，彻底消除因斜边朝向不同导致拟合失败的问题。

#### (3) 4x 超采样 ESF (Edge Spread Function)
计算每个像素到拟合直线的法向投影距离：
$$d = (x - (k y + b)) \cdot \cos(\arctan(k))$$
将距离以 $\frac{1}{4}$ 像素为分箱间隔（Bin Width = 0.25 px）进行统计平均与线性插值补齐，得到 4 倍超采样的边缘扩散函数。

#### (4) 汉宁窗加权 LSF 与 DFT 频域响应
- 差分求导获取线扩散函数：$\text{LSF}(n) = \text{ESF}(n+1) - \text{ESF}(n)$。
- 截取以 LSF 峰值为中心的 128 点窗口，乘以汉宁窗（Hanning Window）：
  $$w(n) = 0.5 - 0.5 \cos\left(\frac{2\pi n}{N - 1}\right)$$
- 执行离散傅里叶变换（DFT）：
  $$\text{MTF}(f) = \frac{|\text{DFT}(\text{LSF})|}{|\text{DFT}(\text{LSF})|_{f=0}}$$
- 搜索 $\text{MTF}(f) = 0.5$ 处的截断频率，输出 **MTF50**（单位：cycles/pixel）。

---

## 3. 代码模块目录结构

```
mtf-analyzer/
├── docs/
│   ├── ARCHITECTURE.md          # 本架构设计与算法原理文档
│   └── MAINTENANCE.md           # 维护、调试与扩展指南
├── src/
│   ├── types/
│   │   └── mtf.ts               # 全局 TypeScript 接口定义
│   ├── core/
│   │   ├── index.ts             # 算法总导出与顶层分析接口
│   │   ├── lensQuality.ts       # 全图画质诊断引擎 (热力图/九宫格/色散/暗角)
│   │   ├── autoEdgeDetector.ts  # 智能斜边自动探测器
│   │   ├── edgeDetection.ts     # 双向自适应斜边最小二乘拟合
│   │   ├── esfLsf.ts            # 4x 超采样 ESF 与汉宁窗 LSF 构造
│   │   ├── dft.ts               # DFT 变换与 MTF50 插值计算
│   │   ├── grayscale.ts         # sRGB 物理线性灰度提取
│   │   └── synthetic.ts         # 标板与模拟斜边样张生成器
│   ├── components/
│   │   ├── Header.tsx           # 顶部导航、双模式切换与样张加载
│   │   ├── ImageWorkspace.tsx   # Canvas 视口、热力图叠加与智能斜边标记
│   │   ├── LensQualityDashboard.tsx # 全图画质评分、指标条与诊断报告面板
│   │   ├── ZoneMatrixView.tsx   # 九宫格像场对比交互卡片
│   │   ├── MetricsCards.tsx     # MTF50 与角度指标卡片
│   │   ├── GuideSection.tsx     # 原理与使用指南弹窗
│   │   └── Charts/
│   │       ├── MtfChart.tsx     # MTF 空间频率响应曲线 (SVG)
│   │       └── EsfLsfChart.tsx  # ESF / LSF 空间域曲线 (SVG)
│   ├── App.tsx                  # 主应用组件
│   └── index.css                # 现代科技感深色主题样式系统
```
