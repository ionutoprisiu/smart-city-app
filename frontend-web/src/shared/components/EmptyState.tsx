import React from 'react';
import { Icon } from './Icon';

type Props = {
  iconName: string;
  title: string;
  subtitle: string;
};

export const EmptyState: React.FC<Props> = ({ iconName, title, subtitle }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        background: 'color-mix(in srgb, var(--surface-container-highest) 60%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={iconName} size={40} color="var(--on-surface-variant)" />
    </div>
    <div className="title-medium" style={{ marginTop: 24 }}>{title}</div>
    <div
      className="body-medium"
      style={{ color: 'var(--on-surface-variant)', marginTop: 8, lineHeight: '20px' }}
    >
      {subtitle}
    </div>
  </div>
);
