import { Logger } from '../utils/logger';

const cache = new Map<string, string>();
const UNKNOWN = 'Street unavailable';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

const cacheKey = (lat: number, lon: number) =>
  `${lat.toFixed(5)},${lon.toFixed(5)}`;

const formatStreet = (address: any): string => {
  const street: string = (address?.road ?? address?.pedestrian ?? '').trim();
  const subLocality: string = (address?.suburb ?? address?.neighbourhood ?? '').trim();
  const locality: string = (address?.city ?? address?.town ?? address?.village ?? '').trim();
  if (street.length > 0) return street;
  if (subLocality.length > 0) return subLocality;
  if (locality.length > 0) return locality;
  return UNKNOWN;
};

export const AddressService = {
  async streetFromCoordinates(latitude: number, longitude: number): Promise<string> {
    const key = cacheKey(latitude, longitude);
    const cached = cache.get(key);
    if (cached) return cached;

    try {
      const url = `${NOMINATIM_URL}?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'licenta-app/1.0 (React Native)',
        },
      });
      if (!response.ok) {
        cache.set(key, UNKNOWN);
        return UNKNOWN;
      }
      const json = await response.json();
      const street = formatStreet(json?.address);
      cache.set(key, street);
      return street;
    } catch (e) {
      Logger.warning('AddressService failed', e);
      cache.set(key, UNKNOWN);
      return UNKNOWN;
    }
  },
};
