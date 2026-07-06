import React, { useEffect, useState } from 'react';
import { AppButton } from '@shared/components/AppButton';
import { BottomSheet } from '@shared/components/BottomSheet';
import { Icon } from '@shared/components/Icon';
import { AddressService } from '@shared/services/addressService';
import { Attraction, AttractionCategory, categoryIcon, categoryLabel } from '../types';

type Props = {
  attraction: Attraction | null;
  isSelected: boolean;
  onToggleSelection: () => void;
  onClose: () => void;
};

// Per-category accent, matching the catalog cards for a cohesive look.
const CATEGORY_TINT: Record<AttractionCategory, string> = {
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

export const AttractionDetailsSheet: React.FC<Props> = ({
  attraction,
  isSelected,
  onToggleSelection,
  onClose,
}) => {
  const [street, setStreet] = useState('Se încarcă strada…');

  useEffect(() => {
    let cancelled = false;
    if (attraction != null) {
      setStreet('Se încarcă strada…');
      AddressService.streetFromCoordinates(
        attraction.latitude,
        attraction.longitude,
        attraction.city,
      ).then((value) => {
        if (!cancelled) setStreet(value);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [attraction]);

  const tint = attraction ? CATEGORY_TINT[attraction.category] : CATEGORY_TINT.other;

  return (
    <BottomSheet open={attraction != null} onClose={onClose}>
      {attraction == null ? null : (
        <>
          {/* Category-tinted hero banner */}
          <div
            className="ad-hero"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 22%, var(--surface-container-high)), color-mix(in srgb, ${tint} 6%, var(--surface-container-high)))`,
            }}
          >
            <div className="ad-hero-tile" style={{ background: `color-mix(in srgb, ${tint} 20%, #fff)` }}>
              {categoryIcon(attraction.category)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="title-large" style={{ lineHeight: 1.2 }}>{attraction.name}</div>
              <div className="ad-chips">
                <span
                  className="ad-chip"
                  style={{ color: tint, background: `color-mix(in srgb, ${tint} 14%, transparent)` }}
                >
                  <Icon name="category" size={13} color={tint} />
                  {categoryLabel(attraction.category)}
                </span>
                {attraction.importanceScore > 0 ? (
                  <span
                    className="ad-chip ad-score"
                    title="Scor de importanță (premiul folosit de algoritm)"
                  >
                    ★ {attraction.importanceScore.toFixed(1)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ padding: '18px 22px 30px' }}>
            {attraction.description ? (
              <div className="body-large" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                {attraction.description}
              </div>
            ) : null}

            <div className="ad-info">
              <div className="ad-info-row">
                <Icon name="signpost" size={19} color="var(--primary)" />
                <span className="body-medium">{street}</span>
              </div>
              <div className="ad-info-row">
                <Icon name="my-location" size={19} color="var(--primary)" />
                <span className="body-medium">
                  {attraction.latitude.toFixed(4)}, {attraction.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            <div style={{ height: 20 }} />
            <AppButton
              label={isSelected ? 'Scoate din traseu' : 'Adaugă în traseu'}
              variant={isSelected ? 'destructive' : 'filled'}
              iconName={isSelected ? 'remove-circle-outline' : 'add-circle-outline'}
              onPress={() => {
                onToggleSelection();
                onClose();
              }}
            />
            {!isSelected ? (
              <div className="ad-hint">
                <Icon name="info-outline" size={13} />
                Adaug-o, apoi apasă „Optimizează" pentru traseul optim
              </div>
            ) : null}
          </div>
        </>
      )}
    </BottomSheet>
  );
};
