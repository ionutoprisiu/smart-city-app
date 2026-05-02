/** Product scope: events and clubs are always in this city. */
export const ACTIVITIES_CITY = 'Cluj-Napoca' as const;

/** Default map region for picking event locations in Cluj-Napoca. */
export const ACTIVITIES_MAP_CENTER = { latitude: 46.7712, longitude: 23.5898 } as const;

export const ACTIVITIES_MAP_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 } as const;
