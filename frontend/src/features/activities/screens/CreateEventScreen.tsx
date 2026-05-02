import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, MapPressEvent, MarkerDragStartEndEvent } from 'react-native-maps';
import { ActivitiesStackParamList } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { AddressService } from '../../../shared/services/addressService';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ACTIVITIES_CITY, ACTIVITIES_MAP_CENTER, ACTIVITIES_MAP_DELTA } from '../constants';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'CreateEvent'>;

const EVENT_CATEGORIES = ['GENERAL', 'CULTURE', 'MUSIC', 'FOOD', 'SPORTS', 'TECH', 'OTHER'] as const;

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

export const CreateEventScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
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

  const themedStyles = useMemo(
    () => ({
      inputBg: { backgroundColor: theme.colors.surfaceContainerLow },
      inputText: { color: theme.colors.onSurface },
      placeholder: theme.colors.onSurfaceVariant,
      label: { color: theme.colors.onSurfaceVariant },
      sectionTitle: { color: theme.colors.onSurface },
      chipActive: { backgroundColor: theme.colors.primaryContainer },
      chipInactive: { backgroundColor: theme.colors.surfaceContainerHigh },
      chipTextActive: { color: theme.colors.onPrimaryContainer },
      chipTextInactive: { color: theme.colors.onSurfaceVariant },
    }),
    [theme],
  );

  const scheduleReverseGeocode = (lat: number, lng: number) => {
    if (geocodeTimerRef.current != null) clearTimeout(geocodeTimerRef.current);
    setIsGeocoding(true);
    geocodeTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const line = await AddressService.streetFromCoordinates(lat, lng, ACTIVITIES_CITY);
          if (line.trim().length > 0 && line !== 'Street unavailable') {
            setLocationName(line);
          }
        } finally {
          setIsGeocoding(false);
        }
      })();
    }, 650);
  };

  useEffect(() => {
    scheduleReverseGeocode(pin.latitude, pin.longitude);
    return () => {
      if (geocodeTimerRef.current != null) clearTimeout(geocodeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMapPress = (e: MapPressEvent) => {
    const c = e.nativeEvent.coordinate;
    setPin({ latitude: c.latitude, longitude: c.longitude });
    scheduleReverseGeocode(c.latitude, c.longitude);
  };

  const onMarkerDragEnd = (e: MarkerDragStartEndEvent) => {
    const c = e.nativeEvent.coordinate;
    setPin({ latitude: c.latitude, longitude: c.longitude });
    scheduleReverseGeocode(c.latitude, c.longitude);
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
        creatorUserId: currentUser.id,
        title: t,
        description: description.trim() || undefined,
        category,
        locationName: locationName.trim() || null,
        latitude: pin.latitude,
        longitude: pin.longitude,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      navigation.goBack();
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not create event'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

      <Text style={[theme.typography.titleSmall, themedStyles.sectionTitle]}>Details</Text>
      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Old Town photo walk"
        placeholderTextColor={themedStyles.placeholder}
        style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
      />
      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Short description for attendees"
        placeholderTextColor={themedStyles.placeholder}
        multiline
        style={[styles.input, styles.inputMultiline, themedStyles.inputBg, themedStyles.inputText]}
      />

      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Category</Text>
      <View style={styles.chipWrap}>
        {EVENT_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[
              styles.chip,
              category === c ? themedStyles.chipActive : themedStyles.chipInactive,
            ]}
          >
            <Text
              style={[
                theme.typography.labelMedium,
                category === c ? themedStyles.chipTextActive : themedStyles.chipTextInactive,
              ]}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[theme.typography.titleSmall, themedStyles.sectionTitle, styles.sectionSpacer]}>
        Schedule
      </Text>
      <View style={styles.row2}>
        <View style={styles.rowItem}>
          <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Start date</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themedStyles.placeholder}
            autoCapitalize="none"
            style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Start time</Text>
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            placeholderTextColor={themedStyles.placeholder}
            autoCapitalize="none"
            style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
          />
        </View>
      </View>
      <View style={styles.row2}>
        <View style={styles.rowItem}>
          <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>End date</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={themedStyles.placeholder}
            autoCapitalize="none"
            style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>End time</Text>
          <TextInput
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            placeholderTextColor={themedStyles.placeholder}
            autoCapitalize="none"
            style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
          />
        </View>
      </View>

      <Text style={[theme.typography.titleSmall, themedStyles.sectionTitle, styles.sectionSpacer]}>
        Location
      </Text>
      <View style={[styles.cityPill, themedStyles.inputBg]}>
        <Text style={[theme.typography.labelMedium, themedStyles.inputText]}>City</Text>
        <Text style={[theme.typography.bodyMedium, themedStyles.inputText, styles.cityPillValue]}>
          {ACTIVITIES_CITY}
        </Text>
      </View>
      <Text style={[theme.typography.bodySmall, themedStyles.label, styles.cityHint]}>
        Events are only published for Cluj-Napoca.
      </Text>

      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Pin on map</Text>
      <Text style={[theme.typography.bodySmall, themedStyles.label, styles.mapHint]}>
        Tap the map or drag the pin. The venue line below updates from the pin (you can edit it).
      </Text>
      <View style={[styles.mapWrap, { borderColor: theme.colors.outlineVariant + '66' }]}>
        <MapView
          style={styles.map}
          initialRegion={{
            ...ACTIVITIES_MAP_CENTER,
            ...ACTIVITIES_MAP_DELTA,
          }}
          onPress={onMapPress}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Marker
            coordinate={pin}
            draggable
            onDragEnd={onMarkerDragEnd}
            title="Meeting point"
          />
        </MapView>
      </View>
      <Pressable onPress={recenterCluj} style={styles.recenterBtn}>
        <Text style={[theme.typography.labelMedium, { color: theme.colors.primary }]}>Recenter on city</Text>
      </Pressable>
      {isGeocoding ? (
        <Text style={[theme.typography.bodySmall, themedStyles.label, styles.geoHint]}>Looking up address…</Text>
      ) : null}

      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Venue / meeting point</Text>
      <TextInput
        value={locationName}
        onChangeText={setLocationName}
        placeholder="Filled from map; edit if needed"
        placeholderTextColor={themedStyles.placeholder}
        style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
      />

      <AppButton
        label="Publish event"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={!currentUser}
        style={styles.submit}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  label: { marginTop: 10, marginBottom: 4 },
  sectionSpacer: { marginTop: 18 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rowItem: { flex: 1 },
  cityPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityPillValue: { fontWeight: '600' },
  cityHint: { marginTop: 6, marginBottom: 2 },
  mapHint: { marginBottom: 8 },
  mapWrap: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: { ...StyleSheet.absoluteFill },
  recenterBtn: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  geoHint: { marginTop: 4 },
  submit: { marginTop: 22 },
});
