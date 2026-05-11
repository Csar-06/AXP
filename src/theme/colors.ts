export const Colors = {
  // Base backgrounds
  bg: '#000000',
  bgElevated: '#111111',
  bgCard: '#1a1a1a',
  bgSurface: '#222222',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#8e8e93',
  textTertiary: '#48484a',

  // Accent (coral/red — matches Apple Music reference)
  accent: '#ff375f',
  accentMuted: 'rgba(255,55,95,0.15)',

  // Player dynamic colors (overridden at runtime by album art palette)
  playerBgDefault: '#2a2505',

  // Controls
  controlActive: '#ffffff',
  controlInactive: '#636366',
  separator: 'rgba(255,255,255,0.08)',

  // Lossless badge
  losslessBg: 'rgba(255,255,255,0.18)',
  losslessText: '#ffffff',

  // Mini player
  miniPlayerBg: 'rgba(18,18,18,0.96)',
  miniPlayerBorder: '#FFFFFF0F',

  // Tab bar
  tabBarBg: 'rgba(0,0,0,0.92)',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  tabBarActive: '#ff375f',
  tabBarInactive: '#636366',
} as const;

export type ColorKey = keyof typeof Colors;
