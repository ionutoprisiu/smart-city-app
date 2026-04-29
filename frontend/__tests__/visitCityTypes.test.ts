import {
  attractionFromJson,
  categoryFromString,
  routeResultFromJson,
} from '../src/features/visit-city/types';

describe('visit-city type mappers', () => {
  test('categoryFromString falls back to other', () => {
    expect(categoryFromString('MUSEUM')).toBe('museum');
    expect(categoryFromString('UNKNOWN_CATEGORY')).toBe('other');
    expect(categoryFromString(undefined)).toBe('other');
  });

  test('attractionFromJson maps backend payload safely', () => {
    const parsed = attractionFromJson({
      id: '11',
      name: 'Central Park',
      description: 'Green area',
      latitude: '46.77',
      longitude: '23.59',
      city: 'Cluj-Napoca',
      category: 'PARK',
    });

    expect(parsed.id).toBe(11);
    expect(parsed.category).toBe('park');
    expect(parsed.isActive).toBe(true);
  });

  test('routeResultFromJson supports fallback path + defaults', () => {
    const parsed = routeResultFromJson({
      steps: [
        {
          order: 1,
          attractionId: 7,
          attractionName: 'Museum',
          latitude: 46.77,
          longitude: 23.59,
        },
      ],
      totalDistance: 2.4,
      totalTime: '31',
      path: [{ latitude: 46.77, longitude: 23.59 }],
      usedOsrm: true,
    });

    expect(parsed.totalTime).toBe(31);
    expect(parsed.travelTimeMinutes).toBe(31);
    expect(parsed.routeGeometry).toHaveLength(1);
    expect(parsed.routingProfile).toBe('driving');
  });
});
