import React from 'react';
import { Icon } from '@shared/components/Icon';

type Props = {
  count: number;
  onClearAll: () => void;
};

export const CustomPinsBanner: React.FC<Props> = ({ count, onClearAll }) => (
  <div
    className="glass-panel"
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      borderRadius: 22,
      gap: 12,
    }}
  >
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--error) 14%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name="push-pin" size={19} color="var(--error)" />
    </span>
    <span className="title-small" style={{ flex: 1 }}>
      {count} custom pin{count === 1 ? '' : 's'} on map
    </span>
    <button type="button" onClick={onClearAll} style={{ padding: '8px 12px', borderRadius: 10 }}>
      <span className="label-large" style={{ color: 'var(--primary)' }}>Clear all</span>
    </button>
  </div>
);
