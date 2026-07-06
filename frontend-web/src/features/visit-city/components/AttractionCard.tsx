import React from 'react';
import { Icon } from '@shared/components/Icon';
import { Attraction, categoryIcon, categoryLabel } from '../types';

type Props = {
  attraction: Attraction;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPress: () => void;
};

const CATEGORY_TINTS: Record<Attraction['category'], string> = {
  museum: '#5C6BC0',
  church: '#8D6E63',
  square: '#546E7A',
  monument: '#6D4C41',
  fortress: '#7B1FA2',
  park: '#2E7D32',
  restaurant: '#EF6C00',
  cafe: '#A1887F',
  shop: '#00897B',
  theater: '#3949AB',
  library: '#455A64',
  hotel: '#5D4037',
  other: '#616161',
};

export const AttractionCard: React.FC<Props> = ({
  attraction,
  isSelected,
  onToggleSelection,
  onPress,
}) => {
  const tint = CATEGORY_TINTS[attraction.category];
  return (
    <div className={`attraction-card${isSelected ? ' selected' : ''}`} onClick={onPress}>
      <div
        className="cat-tile"
        style={{
          background: `color-mix(in srgb, ${tint} 16%, var(--surface-container-low))`,
        }}
      >
        {categoryIcon(attraction.category)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="title-small"
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: 15,
          }}
        >
          {attraction.name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            minWidth: 0,
          }}
        >
          <span
            className="label-small"
            style={{
              color: `color-mix(in srgb, ${tint} 75%, var(--on-surface))`,
              background: `color-mix(in srgb, ${tint} 12%, transparent)`,
              padding: '2px 8px',
              borderRadius: 100,
              flexShrink: 0,
            }}
          >
            {categoryLabel(attraction.category)}
          </span>
          {attraction.importanceScore > 0 ? (
            <span className="score-chip" title="Scor de importanță">
              ★ {attraction.importanceScore.toFixed(1)}
            </span>
          ) : null}
          {isSelected ? (
            <span
              className="label-small"
              style={{
                color: 'var(--primary-strong)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
              }}
            >
              <Icon name="route" size={12} />
              În traseu
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={`select-btn${isSelected ? ' selected' : ''}`}
        title={isSelected ? 'Scoate din traseu' : 'Adaugă în traseu'}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelection();
        }}
      >
        <Icon
          name={isSelected ? 'check' : 'add'}
          size={19}
          color={isSelected ? 'var(--on-primary)' : 'var(--on-surface-variant)'}
        />
      </button>
    </div>
  );
};
