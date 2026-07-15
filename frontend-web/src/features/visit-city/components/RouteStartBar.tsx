import React from 'react';
import { AppButton } from '@shared/components/AppButton';
import { Icon } from '@shared/components/Icon';

type Props = {
  onStart: () => void;
  onModify: () => void;
  modifyLabel?: string;
  // When true, drop the own panel so it can sit under a shared card (top divider).
  bare?: boolean;
};

export const RouteStartBar: React.FC<Props> = ({
  onStart,
  onModify,
  modifyLabel = 'Modifică',
  bare = false,
}) => (
  <div
    className={bare ? undefined : 'glass-panel'}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: bare ? '12px 18px 16px' : '12px 16px',
      borderRadius: bare ? 0 : 22,
      gap: 8,
      borderTop: bare ? '1px solid color-mix(in srgb, var(--outline-variant) 30%, transparent)' : undefined,
    }}
  >
    <span
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--primary) 13%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name="route" size={20} color="var(--primary-strong)" />
    </span>
    <span className="title-small" style={{ marginLeft: 4, flex: 1 }}>Traseu pregătit</span>
    <AppButton
      label={modifyLabel}
      variant="text"
      onPress={onModify}
      style={{ width: 'auto', padding: '8px 12px', minHeight: 0 }}
    />
    <AppButton
      label="Pornește"
      variant="filled"
      iconName="play-arrow"
      onPress={onStart}
      style={{ width: 'auto', padding: '10px 22px', minHeight: 0, borderRadius: 100 }}
    />
  </div>
);
