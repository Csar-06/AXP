import { Platform } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,

  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  hero: 34,

  // Line heights
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,

  font: systemFont,
};

export const textStyle = (
  size: number,
  weight: string,
  color: string,
  extra?: object,
) => ({
  fontFamily: systemFont,
  fontSize: size,
  fontWeight: weight,
  color,
  ...extra,
});
