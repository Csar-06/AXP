import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'axp.settings' });

const KEYS = {
  dynamicTheming: 'dynamicTheming',
  showLosslessBadge: 'showLosslessBadge',
  preferAlbumArtist: 'preferAlbumArtist',
  pauseOnAudioFocusLoss: 'pauseOnAudioFocusLoss',
  scanOnStartup: 'scanOnStartup',
  defaultSort: 'defaultSort',
} as const;

export type DefaultSort = 'title' | 'artist' | 'album' | 'dateAdded';

export type SettingsState = {
  dynamicTheming: boolean;
  showLosslessBadge: boolean;
  preferAlbumArtist: boolean;
  pauseOnAudioFocusLoss: boolean;
  scanOnStartup: boolean;
  defaultSort: DefaultSort;

  setDynamicTheming: (v: boolean) => void;
  setShowLosslessBadge: (v: boolean) => void;
  setPreferAlbumArtist: (v: boolean) => void;
  setPauseOnAudioFocusLoss: (v: boolean) => void;
  setScanOnStartup: (v: boolean) => void;
  setDefaultSort: (v: DefaultSort) => void;
};

function readBool(key: string, fallback: boolean): boolean {
  const v = storage.getBoolean(key);
  return v === undefined ? fallback : v;
}

function readString<T extends string>(key: string, fallback: T): T {
  const v = storage.getString(key);
  return (v as T) ?? fallback;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  dynamicTheming: readBool(KEYS.dynamicTheming, true),
  showLosslessBadge: readBool(KEYS.showLosslessBadge, true),
  preferAlbumArtist: readBool(KEYS.preferAlbumArtist, false),
  pauseOnAudioFocusLoss: readBool(KEYS.pauseOnAudioFocusLoss, true),
  scanOnStartup: readBool(KEYS.scanOnStartup, false),
  defaultSort: readString<DefaultSort>(KEYS.defaultSort, 'title'),

  setDynamicTheming: (v) => {
    storage.set(KEYS.dynamicTheming, v);
    set({ dynamicTheming: v });
  },
  setShowLosslessBadge: (v) => {
    storage.set(KEYS.showLosslessBadge, v);
    set({ showLosslessBadge: v });
  },
  setPreferAlbumArtist: (v) => {
    storage.set(KEYS.preferAlbumArtist, v);
    set({ preferAlbumArtist: v });
  },
  setPauseOnAudioFocusLoss: (v) => {
    storage.set(KEYS.pauseOnAudioFocusLoss, v);
    set({ pauseOnAudioFocusLoss: v });
  },
  setScanOnStartup: (v) => {
    storage.set(KEYS.scanOnStartup, v);
    set({ scanOnStartup: v });
  },
  setDefaultSort: (v) => {
    storage.set(KEYS.defaultSort, v);
    set({ defaultSort: v });
  },
}));
