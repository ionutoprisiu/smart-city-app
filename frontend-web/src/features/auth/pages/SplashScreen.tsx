import React from 'react';
import { Spinner } from '@shared/components/Spinner';

export const SplashScreen: React.FC = () => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface)',
    }}
  >
    <div
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        background: 'var(--primary-container)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span className="headline-small" style={{ color: 'var(--on-primary-container)' }}>SC</span>
    </div>
    <div className="title-large" style={{ marginTop: 24 }}>Smart City</div>
    <Spinner size="small" style={{ marginTop: 24 }} />
  </div>
);
