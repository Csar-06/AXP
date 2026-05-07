import { create } from 'zustand';
import TrackPlayer, {
  State,
  RepeatMode,
  Track as RNTPTrack,
} from 'react-native-track-player';
import type { Track } from '@/db/library';
import {
  loadAndPlay,
  playPause,
  seekTo,
  skipToNext,
  skipToPrevious,
  setRepeatMode,
  shuffleTracks,
} from '@/audio/AudioEngine';

export type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  position: number;
  duration: number;
  isPlayerVisible: boolean;

  // Actions
  play: (tracks: Track[], startIndex?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (pos: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => Promise<void>;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (v: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setPlayerVisible: (v: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  isShuffle: false,
  repeatMode: RepeatMode.Off,
  position: 0,
  duration: 0,
  isPlayerVisible: false,

  play: async (tracks, startIndex = 0) => {
    const { isShuffle } = get();
    let ordered = tracks;
    let index = startIndex;
    if (isShuffle) {
      ordered = shuffleTracks(tracks);
      index = 0;
    }
    set({ queue: ordered, currentTrack: ordered[index] ?? null });
    await loadAndPlay(ordered, index);
  },

  togglePlayPause: async () => {
    await playPause();
  },

  next: async () => {
    await skipToNext();
  },

  previous: async () => {
    await skipToPrevious();
  },

  seek: async (pos) => {
    await seekTo(pos);
    set({ position: pos });
  },

  toggleShuffle: () => {
    set((s) => ({ isShuffle: !s.isShuffle }));
  },

  cycleRepeat: async () => {
    const current = get().repeatMode;
    const next =
      current === RepeatMode.Off
        ? RepeatMode.Queue
        : current === RepeatMode.Queue
        ? RepeatMode.Track
        : RepeatMode.Off;
    await setRepeatMode(next);
    set({ repeatMode: next });
  },

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPosition: (pos) => set({ position: pos }),
  setDuration: (dur) => set({ duration: dur }),
  setPlayerVisible: (v) => set({ isPlayerVisible: v }),
}));
