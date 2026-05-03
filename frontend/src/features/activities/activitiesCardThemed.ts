import type { TextStyle, ViewStyle } from 'react-native';

/** Theme-derived styles passed from Activities home into list cards. */
export type ActivitiesCardThemed = {
  cardBg: ViewStyle;
  cardTitle: TextStyle;
  cardSub: TextStyle;
  tagBg: ViewStyle;
  tagText: TextStyle;
  ctaBg: ViewStyle;
  ctaText: TextStyle;
  ctaDisabledBg: ViewStyle;
  ctaDisabledText: TextStyle;
  mutedIcon: string;
};
