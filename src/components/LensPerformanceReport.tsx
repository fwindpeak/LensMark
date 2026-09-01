import React, { useState } from 'react';
import { LensPerformanceReport as LensPerformanceReportType } from '../types/evaluation';
import { AttributionBadge } from './AttributionBadge';
import {
  ShieldCheck,
  Award,
  CircleDot,
  Compass,
  Camera,
  Maximize2,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LensPerformanceReportProps {
  report: LensPerformanceReportType | null;
  onSwitchToEdgeRoiMode?: () => void;
}

export const LensPerformanceReport: React.FC<LensPerformanceReportProps> = ({
  report,
}) => {
  const [showAttributionDetails, setShowAttributionDetails] = useState(true);

  if (!report) {
    return (
      <div
        className="card-glass"
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Camera size={28} color="var(--accent-color)" />
        <span>正在评估镜头光学表现与归因检查...</span>
      </div>
    );
  }

  const {
    lensMetadata,
    attributionCheck,
    resolution,
    lateralCa,
    vignetting,
    distortion,
    locaNote,
    flareNote,
    bokehNote,
    systemMtfDisclaimer,
  } = report;

  const checks = attributionCheck.checks;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 镜头与测试条件分组元数据 */}
      <div
        className="card-glass"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              测试镜头与机身参数分组 (Focal Length × Aperture × Distance)
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
              {lensMetadata.lensModel}
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: lensMetadata.sourceFormat.includes('RAW')
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${
                lensMetadata.sourceFormat.includes('RAW')
                  ? 'rgba(34, 197, 94, 0.3)'
                  : 'rgba(245, 158, 11, 0.3)'
              }`,
              color: lensMetadata.sourceFormat.includes('RAW') ? '#4ade80' : '#fbbf24',
              fontWeight: 600,
            }}
          >
            {lensMetadata.sourceFormat}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>机身：</span>{lensMetadata.cameraBody}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>焦距：</span>{lensMetadata.focalLength}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>光圈：</span>{lensMetadata.aperture}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>物距：</span>{lensMetadata.focusDistance}</div>
          <div><span style={{ color: 'var(--text-muted)' }}>曝光：</span>{lensMetadata.shutterSpeed} ({lensMetadata.iso})</div>
        </div>
      </div>

      {/* 归因检查机制卡片 (Attribution Check) */}
      <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowAttributionDetails(!showAttributionDetails)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--accent-color)" />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
              归因检查：排除景深、失焦、抖动、光照与处理干扰
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {attributionCheck.overallValidForLensTest ? '满足标板分析条件' : '环境/边缘需注意'}
            </span>
            {showAttributionDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {showAttributionDetails && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(checks).map((chk) => (
              <div
                key={chk.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{chk.title}</span>
                    <AttributionBadge checkStatus={chk.status} size="sm" />
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.4 }}>
                    {chk.evidence}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4 项核心光学量化指标 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* 1. 解析力 / 空间频率响应 MTF50 */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Award size={16} color="var(--accent-color)" />
              {resolution.name}
            </div>
            <AttributionBadge validity={resolution.validity} />
          </div>

          {resolution.value ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>中心 MTF50</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {resolution.value.mtf50Center}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>c/p</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>≈ {resolution.value.lwphEstimateCenter} LW/PH</div>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0.7 像高中场 MTF50</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>
                    {resolution.value.mtf50Mid}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>c/p</span>
                  </div>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>边缘衰减率</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                    {resolution.value.cornerFalloffPct}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              {resolution.missingEvidence?.[0] || '需框选包含标准斜边的 ROI 区域以定量计算 MTF。'}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>测试条件：</strong>{resolution.testConditionRequired}</div>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>当前依据：</strong>{resolution.actualConditionObserved}</div>
          </div>
        </div>

        {/* 2. 横向色差 (Lateral CA) */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <CircleDot size={16} color="#c084fc" />
              {lateralCa.name}
            </div>
            <AttributionBadge validity={lateralCa.validity} />
          </div>

          {lateralCa.value ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>红/蓝相对绿色通道边缘错位</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
                  {lateralCa.value.rbShiftPx} <span style={{ fontSize: '11px' }}>px</span>
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>色散等级评估</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
                  {lateralCa.value.grade}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {lateralCa.missingEvidence?.[0] || '缺少画面边缘切向高反差黑白边缘测试条件。'}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>测试条件：</strong>{lateralCa.testConditionRequired}</div>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>当前依据：</strong>{lateralCa.actualConditionObserved}</div>
          </div>
        </div>

        {/* 3. 边角暗角衰减 (Vignetting) */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Maximize2 size={16} color="#fb923c" />
              {vignetting.name}
            </div>
            <AttributionBadge validity={vignetting.validity} />
          </div>

          {vignetting.value && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>边缘光强损失</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fb923c', marginTop: '4px' }}>
                  {vignetting.value.falloffEv} <span style={{ fontSize: '11px' }}>EV</span>
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>四角相对照度</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                  {vignetting.value.relativeIlluminationPct}%
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>测试条件：</strong>{vignetting.testConditionRequired}</div>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>当前依据：</strong>{vignetting.actualConditionObserved}</div>
          </div>
        </div>

        {/* 4. 几何畸变 (Geometric Distortion) */}
        <div className="card-glass" style={{ padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              <Compass size={16} color="#34d399" />
              {distortion.name}
            </div>
            <AttributionBadge validity={distortion.validity} />
          </div>

          {distortion.value ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>畸变率 (SMIA TV)</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                  {distortion.value.distortionPct}%
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>畸变类型</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
                  {distortion.value.distortionType}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {distortion.missingEvidence?.[0] || '缺少标准正交网格标板，无法与透视形变剥离。'}
            </div>
          )}

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>测试条件：</strong>{distortion.testConditionRequired}</div>
            <div><strong style={{ color: 'rgba(255,255,255,0.7)' }}>当前依据：</strong>{distortion.actualConditionObserved}</div>
          </div>
        </div>
      </div>

      {/* 进阶光学特征提示 (轴向色差、抗眩光、焦外) */}
      <div
        className="card-glass"
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} color="var(--accent-color)" />
          进阶光学特征测试说明 (科学定量边界)
        </div>

        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
          <div><strong style={{ color: '#cbd5e1' }}>• 轴向色差 (LoCA)：</strong>{locaNote.requirement}</div>
          <div style={{ marginTop: '4px' }}><strong style={{ color: '#cbd5e1' }}>• 抗眩光与鬼影：</strong>{flareNote.requirement}</div>
          <div style={{ marginTop: '4px' }}><strong style={{ color: '#cbd5e1' }}>• 焦外光斑特征：</strong>{bokehNote.requirement}</div>
        </div>

        <div
          style={{
            marginTop: '6px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {systemMtfDisclaimer}
        </div>
      </div>
    </div>
  );
};
