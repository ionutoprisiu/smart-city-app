import React from 'react';
import { Icon } from '@shared/components/Icon';
import type { ActivityKind } from '../types';
import { activityKindIcon, activityKindLabel } from '../utils/buildActivityListings';

type Props = {
  kind: ActivityKind;
};

export const ActivityKindTag: React.FC<Props> = ({ kind }) => {
  const isEvent = kind === 'event';
  const color = isEvent ? 'var(--on-primary-container)' : 'var(--on-surface-variant)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        borderRadius: 999,
        padding: '4px 10px',
        background: isEvent
          ? 'color-mix(in srgb, var(--primary-container) 80%, transparent)'
          : 'var(--surface-container-high)',
      }}
    >
      <Icon name={activityKindIcon(kind)} size={14} color={color} />
      <span className="label-small" style={{ color }}>{activityKindLabel(kind)}</span>
    </span>
  );
};
