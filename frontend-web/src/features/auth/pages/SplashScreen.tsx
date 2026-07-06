import React from 'react';
import { Spinner } from '@shared/components/Spinner';

export const SplashScreen: React.FC = () => (
  <div className="auth-page" style={{ flexDirection: 'column' }}>
    <div className="brand-badge" style={{ width: 88, height: 88, borderRadius: 26, fontSize: 40 }}>
      🗺️
    </div>
    <div className="headline-small" style={{ marginTop: 20 }}>Smart City</div>
    <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
      Cluj-Napoca
    </div>
    <Spinner size="small" style={{ marginTop: 22 }} />
  </div>
);
