import React from 'react';
import { Icon } from './Icon';

type Props = {
  message?: string | null;
  onRetry?: () => void;
  iconName?: string;
};

export const ErrorMessage: React.FC<Props> = ({
  message,
  onRetry,
  iconName = 'cloud-off',
}) => {
  if (!message) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          padding: 18,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--error-container) 45%, transparent)',
          display: 'flex',
        }}
      >
        <Icon name={iconName} size={40} color="var(--error)" />
      </div>
      <div className="title-medium" style={{ marginTop: 24 }}>
        Something went wrong
      </div>
      <div
        className="body-medium"
        style={{ color: 'var(--on-surface-variant)', marginTop: 8, lineHeight: '20px' }}
      >
        {message}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            borderRadius: 16,
            background: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
            fontWeight: 600,
            fontSize: 14,
            marginTop: 24,
          }}
        >
          <Icon name="refresh" size={18} color="var(--on-primary-container)" />
          Try again
        </button>
      ) : null}
    </div>
  );
};
