import React from 'react';
import { Icon } from '@shared/components/Icon';
import { ROUTE_SEGMENT_COLORS } from '../constants/routeColors';
import { RouteResult } from '../types';

type Props = {
  result: RouteResult;
  compact?: boolean;
};

export const RouteStepsList: React.FC<Props> = ({ result, compact = false }) => {
  const height = compact ? 104 : 148;
  const cardWidth = compact ? 112 : 128;
  const avatarSize = compact ? 32 : 40;

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        height,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          height: '100%',
          padding: compact ? 12 : 16,
        }}
      >
        {result.steps.map((step, index) => {
          const isStart = step.attractionId === 0;
          const legColor =
            index < result.steps.length - 1
              ? ROUTE_SEGMENT_COLORS[index % ROUTE_SEGMENT_COLORS.length]
              : null;
          return (
            <React.Fragment key={`${step.order}-${step.attractionId}`}>
              <div
                style={{
                  width: cardWidth,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    background: isStart ? '#1A73E8' : (legColor ?? 'var(--primary)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-primary)',
                  }}
                >
                  {isStart ? (
                    <Icon name="school" size={compact ? 18 : 20} color="#fff" />
                  ) : (
                    <span style={{ color: 'var(--on-primary)', fontSize: compact ? 13 : 15, fontWeight: 700 }}>
                      {step.order}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    marginTop: compact ? 8 : 10,
                    textAlign: 'center',
                    fontSize: compact ? 13 : 14,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: compact ? 1 : 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {step.attractionName}
                </div>
                {!compact && step.distanceToNext != null ? (
                  <div className="label-small" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
                    {step.distanceToNext.toFixed(1)} km
                  </div>
                ) : null}
              </div>
              {index < result.steps.length - 1 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '0 4px',
                    flexShrink: 0,
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: compact ? 14 : 18,
                      height: 3,
                      borderRadius: 2,
                      background: legColor ?? 'var(--outline)',
                    }}
                  />
                  <Icon
                    name="chevron-right"
                    size={compact ? 18 : 22}
                    color={legColor ?? 'color-mix(in srgb, var(--outline) 55%, transparent)'}
                  />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
