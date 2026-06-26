import React from 'react';
import { Icon } from '@shared/components/Icon';
import { ROUTE_START_POINT } from '@shared/utils/geo';

type Props = {
  hasRoute: boolean;
  routeStarted: boolean;
  onRecenter: () => void;
  onModify: () => void;
  onClear: () => void;
};

export const MapControlsCard: React.FC<Props> = ({
  hasRoute,
  routeStarted,
  onRecenter,
  onModify,
  onClear,
}) => (
  <div
    className="glass-panel"
    style={{
      borderRadius: 26,
      padding: 5,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
    }}
  >
    <button
      type="button"
      className="map-fab"
      onClick={onRecenter}
      title={ROUTE_START_POINT.name}
    >
      <Icon name="school" size={21} color="var(--primary-strong)" />
    </button>
    {hasRoute ? (
      <>
        {routeStarted ? (
          <button type="button" className="map-fab" onClick={onModify} title="Modify route">
            <Icon name="edit" size={20} />
          </button>
        ) : null}
        <button type="button" className="map-fab" onClick={onClear} title="Clear route">
          <Icon name="close" size={20} color="var(--error)" />
        </button>
      </>
    ) : null}
  </div>
);
