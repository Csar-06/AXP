import { create } from 'zustand';
import { Colors } from '@/theme';

export type ThemeState = {
  playerBg: string;
  playerBgSecondary: string;
  setFromImage: (imageUri: string | null) => Promise<void>;
  reset: () => void;
};

function darken(hex: string, amount = 0.4): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const useThemeStore = create<ThemeState>((set) => ({
  playerBg: Colors.playerBgDefault,
  playerBgSecondary: darken(Colors.playerBgDefault, 0.5),

  setFromImage: async (imageUri) => {
    if (!imageUri) {
      set({
        playerBg: Colors.playerBgDefault,
        playerBgSecondary: darken(Colors.playerBgDefault, 0.5),
      });
      return;
    }
    try {
      const { getColors } = await import('react-native-image-colors');
      const result = await getColors(imageUri, {
        fallback: Colors.playerBgDefault,
        cache: true,
        key: imageUri,
      });

      let dominant: string = Colors.playerBgDefault;
      if (result.platform === 'android') {
        dominant = result.dominant ?? result.average ?? Colors.playerBgDefault;
      } else if (result.platform === 'ios') {
        dominant = result.background ?? result.primary ?? Colors.playerBgDefault;
      } else {
        dominant = result.dominant ?? Colors.playerBgDefault;
      }

      set({
        playerBg: darken(dominant, 0.25),
        playerBgSecondary: darken(dominant, 0.6),
      });
    } catch {
      set({
        playerBg: Colors.playerBgDefault,
        playerBgSecondary: darken(Colors.playerBgDefault, 0.5),
      });
    }
  },

  reset: () =>
    set({
      playerBg: Colors.playerBgDefault,
      playerBgSecondary: darken(Colors.playerBgDefault, 0.5),
    }),
}));
