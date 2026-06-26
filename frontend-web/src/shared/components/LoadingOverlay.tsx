import React from 'react';
import { Spinner } from './Spinner';

type Props = {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
};

export const LoadingOverlay: React.FC<Props> = ({ isLoading, children, message }) => (
  <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    {children}
    {isLoading ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}
      >
        <div
          style={{
            background: 'var(--surface-container-high)',
            borderRadius: 20,
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Spinner size="large" />
          {message ? (
            <div
              className="body-medium"
              style={{ color: 'var(--on-surface-variant)', marginTop: 16, textAlign: 'center' }}
            >
              {message}
            </div>
          ) : null}
        </div>
      </div>
    ) : null}
  </div>
);
