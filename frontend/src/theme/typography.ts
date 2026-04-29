import { TextStyle } from 'react-native';

const family = 'System';

export const typography = {
  headlineLarge: { fontFamily: family, fontSize: 32, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  headlineSmall: { fontFamily: family, fontSize: 24, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  titleLarge: { fontFamily: family, fontSize: 22, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  titleMedium: { fontFamily: family, fontSize: 16, fontWeight: '600' } as TextStyle,
  titleSmall: { fontFamily: family, fontSize: 14, fontWeight: '600' } as TextStyle,
  bodyLarge: { fontFamily: family, fontSize: 16, fontWeight: '400', lineHeight: 22 } as TextStyle,
  bodyMedium: { fontFamily: family, fontSize: 14, fontWeight: '400', lineHeight: 19 } as TextStyle,
  bodySmall: { fontFamily: family, fontSize: 12, fontWeight: '400', lineHeight: 16 } as TextStyle,
  labelLarge: { fontFamily: family, fontSize: 14, fontWeight: '600' } as TextStyle,
  labelMedium: { fontFamily: family, fontSize: 12, fontWeight: '600' } as TextStyle,
  labelSmall: { fontFamily: family, fontSize: 11, fontWeight: '600', letterSpacing: 0.2 } as TextStyle,
};
