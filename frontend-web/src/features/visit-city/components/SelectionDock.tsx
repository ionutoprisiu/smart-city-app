import React from 'react';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { RoutingProfile } from '../types';

type Props = {
  count: number;
  profile: RoutingProfile;
  isOptimizing: boolean;
  canOptimize: boolean;
  onProfileChanged: (profile: RoutingProfile) => void;
  onOptimize?: () => void;
  onClear: () => void;
};

export const SelectionDock: React.FC<Props> = ({
  count,
  profile,
  isOptimizing,
  canOptimize,
  onProfileChanged,
  onOptimize,
  onClear,
}) => {
  const renderSegment = (value: RoutingProfile, icon: string, label: string) => {
    const active = profile === value;
    return (
      <button
        key={value}
        type="button"
        className={`segment${active ? ' active' : ''}`}
        onClick={() => !isOptimizing && onProfileChanged(value)}
      >
        <Icon name={icon} size={17} />
        {label}
      </button>
    );
  };

  return (
    <div className="glass-panel" style={{ borderRadius: 22, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="segmented">
          {renderSegment('driving', 'directions-car', 'Mașină')}
          {renderSegment('foot', 'directions-walk', 'Pe jos')}
        </div>

        <span className="label-large" style={{ color: 'var(--on-surface-variant)', flex: 1 }}>
          <span style={{ color: 'var(--primary-strong)', fontWeight: 700 }}>{count}</span>{' '}
          {count === 1 ? 'selectat' : 'selectate'}
        </span>

        <button type="button" onClick={onClear} style={{ padding: '6px 8px', borderRadius: 10 }}>
          <span className="label-large" style={{ color: 'var(--on-surface-variant)' }}>Șterge</span>
        </button>

        <button
          type="button"
          onClick={() => onOptimize?.()}
          disabled={isOptimizing || onOptimize == null}
          title="Optimizează traseul"
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: 21,
            background: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            color: 'var(--on-primary)',
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: 'var(--shadow-primary)',
            opacity: isOptimizing || onOptimize == null ? 0.55 : 1,
            transition: 'transform var(--transition-fast), filter var(--transition-fast)',
          }}
        >
          {isOptimizing ? (
            <Spinner size="small" style={{ borderTopColor: 'var(--on-primary)' }} />
          ) : (
            <>
              <Icon name="auto-awesome" size={17} color="var(--on-primary)" />
              Optimizează
            </>
          )}
        </button>
      </div>
      {!canOptimize ? (
        <div
          className="label-small"
          style={{
            color: 'var(--on-surface-variant)',
            marginTop: 9,
            marginLeft: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Icon name="info-outline" size={13} />
          Alege cel puțin un obiectiv de vizitat.
        </div>
      ) : null}
    </div>
  );
};
