type ColorScheme = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  tertiary: string;
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  surfaceContainerLow: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  inverseSurface: string;
  onInverseSurface: string;
  scrim: string;
};

export const lightColors: ColorScheme = {
  primary: '#1A73E8',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D6E3FF',
  onPrimaryContainer: '#001A41',
  secondary: '#5F9FFF',
  tertiary: '#7C5800',
  surface: '#FBFCFF',
  onSurface: '#1B1B1F',
  onSurfaceVariant: '#44464F',
  surfaceContainerLow: '#F4F4FA',
  surfaceContainerHigh: '#E8EAF1',
  surfaceContainerHighest: '#E2E2E9',
  outline: '#74777F',
  outlineVariant: '#C4C6CF',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  inverseSurface: '#303033',
  onInverseSurface: '#F2F0F4',
  scrim: '#000000',
};

export const darkColors: ColorScheme = {
  primary: '#8AB4F8',
  onPrimary: '#002E69',
  primaryContainer: '#0E448B',
  onPrimaryContainer: '#D6E3FF',
  secondary: '#5F9FFF',
  tertiary: '#F4BD63',
  surface: '#121316',
  onSurface: '#E3E2E6',
  onSurfaceVariant: '#C4C6CF',
  surfaceContainerLow: '#1B1B1F',
  surfaceContainerHigh: '#2A2A2E',
  surfaceContainerHighest: '#34343A',
  outline: '#8E9099',
  outlineVariant: '#44464F',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  inverseSurface: '#E3E2E6',
  onInverseSurface: '#1B1B1F',
  scrim: '#000000',
};

export type { ColorScheme };
