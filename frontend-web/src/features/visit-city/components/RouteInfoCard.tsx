import React from 'react';
import { Icon } from '@shared/components/Icon';
import { RouteResult } from '../types';

type Props = {
  result: RouteResult;
  layout?: 'floating' | 'dock';
};

const fmt = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const Stat: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: 'color-mix(in srgb, var(--primary) 13%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={16} color="var(--primary-strong)" />
    </span>
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span className="label-small" style={{ color: 'var(--on-surface-variant)' }}>{label}</span>
      <span className="title-small" style={{ fontSize: 14.5 }}>{value}</span>
    </span>
  </div>
);

export const RouteInfoCard: React.FC<Props> = ({ result, layout = 'floating' }) => {
  const travelStr = fmt(result.travelTimeMinutes);
  const totalStr = fmt(result.totalTime);
  const docked = layout === 'dock';

  return (
    <div
      className="glass-panel"
      style={{
        maxWidth: docked ? '100%' : 280,
        padding: '14px 16px',
        borderRadius: 20,
        marginBottom: docked ? 8 : 0,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="auto-awesome" size={14} color="var(--primary-strong)" />
        <span
          className="label-small"
          style={{ color: 'var(--primary-strong)', letterSpacing: 1, textTransform: 'uppercase' }}
        >
          Optimized route
        </span>
        {result.usedOsrm ? (
          <span
            className="label-small"
            style={{
              marginLeft: 'auto',
              color: 'var(--on-surface-variant)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon
              name={result.routingProfile === 'foot' ? 'directions-walk' : 'directions-car'}
              size={14}
            />
            {result.routingProfile === 'foot' ? 'Walking' : 'Driving'} · OSRM
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 8 }}>
        <span className="headline-small" style={{ letterSpacing: -0.6, fontSize: 28 }}>
          {result.totalDistance.toFixed(1)}
        </span>
        <span className="title-medium" style={{ color: 'var(--on-surface-variant)', marginLeft: 6 }}>
          km
        </span>
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
        <Stat icon="schedule" label="Travel" value={travelStr} />
        <Stat icon="timer" label="Total ETA" value={totalStr} />
      </div>
    </div>
  );
};
