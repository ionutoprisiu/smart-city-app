import L from 'leaflet';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { AppButton } from '@shared/components/AppButton';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { AddressService } from '@shared/services/addressService';
import { useAuthStore } from '@features/auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ACTIVITIES_CITY, ACTIVITIES_MAP_CENTER } from '../constants';

const EVENT_CATEGORIES = ['GENERAL', 'CULTURE', 'MUSIC', 'FOOD', 'SPORTS', 'TECH', 'OTHER'] as const;

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

const tomorrowYmd = (): string => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseLocalDateTime = (dateStr: string, timeStr: string): Date | null => {
  const ds = dateStr.trim();
  const ts = timeStr.trim();
  const [y, mo, d] = ds.split('-').map((x) => parseInt(x, 10));
  const timeParts = ts.split(':');
  const hh = parseInt(timeParts[0] ?? '', 10);
  const mm = parseInt(timeParts[1] ?? '0', 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
};

const INITIAL_PIN: { latitude: number; longitude: number } = {
  latitude: ACTIVITIES_MAP_CENTER.latitude,
  longitude: ACTIVITIES_MAP_CENTER.longitude,
};

const pinIcon = L.divIcon({
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  html: '<span class="material-icons-round" style="font-size:36px;color:#EA4335;text-shadow:0 1px 3px rgba(0,0,0,0.4);">place</span>',
});

const MapClick: React.FC<{ onPick: (lat: number, lon: number) => void }> = ({ onPick }) => {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  padding: '11px 12px',
  background: 'var(--surface-container-low)',
  color: 'var(--on-surface)',
  width: '100%',
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  color: 'var(--on-surface-variant)',
  marginTop: 10,
  marginBottom: 4,
};

export const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  const defaults = useMemo(() => ({ ymd: tomorrowYmd() }), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('GENERAL');
  const [locationName, setLocationName] = useState('');
  const [pin, setPin] = useState(INITIAL_PIN);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [startDate, setStartDate] = useState(defaults.ymd);
  const [startTime, setStartTime] = useState('18:00');
  const [endDate, setEndDate] = useState(defaults.ymd);
  const [endTime, setEndTime] = useState('20:00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (geocodeTimerRef.current != null) clearTimeout(geocodeTimerRef.current);
    setIsGeocoding(true);
    geocodeTimerRef.current = setTimeout(() => {
      const runReverseGeocode = async () => {
        try {
          const line = await AddressService.streetFromCoordinates(lat, lng, ACTIVITIES_CITY);
          if (line.trim().length > 0 && line !== 'Street unavailable') {
            setLocationName(line);
          }
        } finally {
          setIsGeocoding(false);
        }
      };
      runReverseGeocode().catch(() => {
        setIsGeocoding(false);
      });
    }, 650);
  }, []);

  useEffect(() => {
    scheduleReverseGeocode(pin.latitude, pin.longitude);
    return () => {
      if (geocodeTimerRef.current != null) clearTimeout(geocodeTimerRef.current);
    };
  }, [pin.latitude, pin.longitude, scheduleReverseGeocode]);

  const onPickPin = (lat: number, lon: number) => {
    setPin({ latitude: lat, longitude: lon });
    scheduleReverseGeocode(lat, lon);
  };

  const recenterCluj = () => {
    setPin(INITIAL_PIN);
    scheduleReverseGeocode(INITIAL_PIN.latitude, INITIAL_PIN.longitude);
  };

  const onSubmit = async () => {
    if (!currentUser) return;
    setErrorMessage(null);
    const t = title.trim();
    if (t.length < 3) {
      setErrorMessage('Title must be at least 3 characters.');
      return;
    }
    const start = parseLocalDateTime(startDate, startTime);
    const end = parseLocalDateTime(endDate, endTime);
    if (!start || !end) {
      setErrorMessage('Use date YYYY-MM-DD and time HH:MM (24h).');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setErrorMessage('End time must be after start time.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ActivitiesApi.createEvent({
        title: t,
        description: description.trim() || undefined,
        category,
        locationName: locationName.trim() || null,
        latitude: pin.latitude,
        longitude: pin.longitude,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      navigate(-1);
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not create event'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <StackHeader title="Create event" />
      <div className="app-content" style={{ overflowY: 'auto' }}>
        <div style={{ padding: '16px 16px 40px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

          <div className="title-small">Details</div>
          <div className="label-medium" style={labelStyle}>Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Old Town photo walk"
            style={inputStyle}
          />
          <div className="label-medium" style={labelStyle}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description for attendees"
            style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
          />

          <div className="label-medium" style={labelStyle}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {EVENT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  borderRadius: 999,
                  padding: '8px 12px',
                  background:
                    category === c ? 'var(--primary-container)' : 'var(--surface-container-high)',
                  color:
                    category === c ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="title-small" style={{ marginTop: 18 }}>Schedule</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <div className="label-medium" style={labelStyle}>Start date</div>
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="label-medium" style={labelStyle}>Start time</div>
              <input
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="HH:MM"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <div className="label-medium" style={labelStyle}>End date</div>
              <input
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="label-medium" style={labelStyle}>End time</div>
              <input
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="HH:MM"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="title-small" style={{ marginTop: 18 }}>Location</div>
          <div
            style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <span className="label-medium">City</span>
            <span className="body-medium" style={{ fontWeight: 600 }}>{ACTIVITIES_CITY}</span>
          </div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
            Events are only published for Cluj-Napoca.
          </div>

          <div className="label-medium" style={labelStyle}>Pin on map</div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginBottom: 8 }}>
            Click the map or drag the pin. The venue line below updates from the pin (you can edit
            it).
          </div>
          <div
            style={{
              height: 220,
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid color-mix(in srgb, var(--outline-variant) 40%, transparent)',
              position: 'relative',
            }}
          >
            <MapContainer
              center={[ACTIVITIES_MAP_CENTER.latitude, ACTIVITIES_MAP_CENTER.longitude]}
              zoom={14}
              style={{ position: 'absolute', inset: 0 }}
              attributionControl={false}
            >
              <TileLayer url={TILE_URL} maxZoom={19} />
              <MapClick onPick={onPickPin} />
              <Marker
                position={[pin.latitude, pin.longitude]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    onPickPin(ll.lat, ll.lng);
                  },
                }}
              />
            </MapContainer>
          </div>
          <button type="button" onClick={recenterCluj} style={{ marginTop: 8, padding: '4px 0' }}>
            <span className="label-medium" style={{ color: 'var(--primary)' }}>Recenter on city</span>
          </button>
          {isGeocoding ? (
            <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Looking up address…
            </div>
          ) : null}

          <div className="label-medium" style={labelStyle}>Venue / meeting point</div>
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Filled from map; edit if needed"
            style={inputStyle}
          />

          <div style={{ height: 22 }} />
          <AppButton
            label="Publish event"
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!currentUser}
          />
        </div>
      </div>
    </div>
  );
};
