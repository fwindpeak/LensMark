import React from 'react';
import { MetricValidity, CheckStatus } from '../types/evaluation';
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle } from 'lucide-react';

interface AttributionBadgeProps {
  validity?: MetricValidity;
  checkStatus?: CheckStatus;
  size?: 'sm' | 'md';
}

export const AttributionBadge: React.FC<AttributionBadgeProps> = ({
  validity,
  checkStatus,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const padding = isSm ? '2px 8px' : '4px 10px';
  const fontSize = isSm ? '11px' : '12px';

  if (validity) {
    if (validity === '可测') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#4ade80',
            borderRadius: '16px',
            padding,
            fontSize,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={isSm ? 12 : 14} />
          {validity}
        </span>
      );
    }

    if (validity === '仅供参考') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
            borderRadius: '16px',
            padding,
            fontSize,
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={isSm ? 12 : 14} />
          {validity}
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          backgroundColor: 'rgba(148, 163, 184, 0.12)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          color: '#cbd5e1',
          borderRadius: '16px',
          padding,
          fontSize,
          fontWeight: 500,
        }}
      >
        <HelpCircle size={isSm ? 12 : 14} />
        {validity}
      </span>
    );
  }

  if (checkStatus) {
    if (checkStatus === 'passed') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            color: '#4ade80',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={12} />
          已通过 / 干扰排除
        </span>
      );
    }

    if (checkStatus === 'warning') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#fbbf24',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={12} />
          存在环境/处理干扰
        </span>
      );
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          borderRadius: '12px',
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        <XCircle size={12} />
        不满足测试条件
      </span>
    );
  }

  return null;
};
