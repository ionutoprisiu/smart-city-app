import React, { useEffect, useState } from 'react';
import { AppButton } from '@shared/components/AppButton';
import { BottomSheet } from '@shared/components/BottomSheet';
import { Icon } from '@shared/components/Icon';
import { AddressService } from '@shared/services/addressService';
import { Attraction, categoryIcon, categoryLabel } from '../types';

type Props = {
  attraction: Attraction | null;
  isSelected: boolean;
  onToggleSelection: () => void;
  onClose: () => void;
};

export const AttractionDetailsSheet: React.FC<Props> = ({
  attraction,
  isSelected,
  onToggleSelection,
  onClose,
}) => {
  const [street, setStreet] = useState('Loading street...');

  useEffect(() => {
    let cancelled = false;
    if (attraction != null) {
      setStreet('Loading street...');
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

  return (
    <BottomSheet open={attraction != null} onClose={onClose}>
      {attraction != null ? (
        <div style={{ padding: '8px 22px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--primary) 22%, var(--surface-container-low)), color-mix(in srgb, var(--primary) 8%, var(--surface-container-low)))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                flexShrink: 0,
                boxShadow: 'var(--shadow-1)',
              }}
            >
              {categoryIcon(attraction.category)}
            </div>
            <div style={{ flex: 1, marginLeft: 16, minWidth: 0 }}>
              <div className="title-large">{attraction.name}</div>
              <span
                className="label-small"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 6,
                  padding: '4px 10px',
                  borderRadius: 100,
                  background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  color: 'var(--primary-strong)',
                }}
              >
                <Icon name="category" size={13} />
                {categoryLabel(attraction.category)}
              </span>
            </div>
          </div>

          <div
            className="body-large"
            style={{ marginTop: 18, color: 'var(--on-surface-variant)' }}
          >
            {attraction.description}
          </div>

          <div
            style={{
              marginTop: 20,
              borderRadius: 16,
              background: 'var(--surface-container-low)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="signpost" size={19} color="var(--primary)" />
              <span className="body-medium">{street}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="location-on" size={19} color="var(--primary)" />
              <span className="body-medium">
                {attraction.latitude.toFixed(4)}, {attraction.longitude.toFixed(4)}
              </span>
            </div>
          </div>

          <div style={{ height: 22 }} />
          <AppButton
            label={isSelected ? 'Remove from route' : 'Add to route'}
            variant={isSelected ? 'destructive' : 'filled'}
            iconName={isSelected ? 'remove-circle-outline' : 'add-circle-outline'}
            onPress={() => {
              onToggleSelection();
              onClose();
            }}
          />
        </div>
      ) : null}
    </BottomSheet>
  );
};
