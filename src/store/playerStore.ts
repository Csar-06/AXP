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
  replaceUpcomingTracks,
  addTracksToEnd,
  insertTracksAfterCurrent as insertTracksAfterCurrentInPlayer,
} from '@/audio/AudioEngine';

export type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  originalQueue: Track[];
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
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearUpcoming: () => Promise<void>;
  /** Append tracks to RNTP and local queue / originalQueue. */
  appendTracksToQueue: (tracks: Track[]) => Promise<void>;
  /** Insert after current track in RNTP and both local queues; if idle, appends. */
  insertTracksAfterCurrent: (tracks: Track[]) => Promise<void>;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (v: boolean) => void;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setPlayerVisible: (v: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  originalQueue: [],
  isPlaying: false,
  isShuffle: false,
  repeatMode: RepeatMode.Off,
  position: 0,
  duration: 0,
  isPlayerVisible: false,

  play: async (tracks, startIndex = 0) => {
    set({
      queue: tracks,
      originalQueue: tracks,
      currentTrack: tracks[startIndex] ?? null,
      isPlayerVisible: true,
      isShuffle: false,
    });
    await loadAndPlay(tracks, startIndex);
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

  toggleShuffle: async () => {
    const { isShuffle, queue, currentTrack, originalQueue } = get();
    const newShuffle = !isShuffle;
    set({ isShuffle: newShuffle });

    if (!currentTrack) return;
    const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
    if (currentIdx < 0) return;

    const played = queue.slice(0, currentIdx + 1);
    const upcoming = queue.slice(currentIdx + 1);

    let newUpcoming: Track[];
    if (newShuffle) {
      newUpcoming = shuffleTracks(upcoming);
    } else {
      // Restore original order for the tracks still in upcoming
      const upcomingIds = new Set(upcoming.map((t) => t.id));
      newUpcoming = originalQueue.filter((t) => upcomingIds.has(t.id));
    }

    const newQueue = [...played, ...newUpcoming];
    set({ queue: newQueue });

    try {
      await replaceUpcomingTracks(newUpcoming);
    } catch (e) {
      console.warn('[playerStore] toggleShuffle replaceUpcomingTracks failed:', e);
    }
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

  removeFromQueue: async (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const next = [...queue.slice(0, index), ...queue.slice(index + 1)];
    set({ queue: next });
    try {
      await TrackPlayer.remove(index);
    } catch (e) {
      console.warn('[playerStore] remove failed:', e);
    }
  },

  clearUpcoming: async () => {
    const { queue, currentTrack } = get();
    if (!currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx < 0) return;
    set({ queue: queue.slice(0, idx + 1) });
    try {
      await TrackPlayer.removeUpcomingTracks();
    } catch (e) {
      console.warn('[playerStore] removeUpcomingTracks failed:', e);
    }
  },

  appendTracksToQueue: async (tracks) => {
    if (tracks.length === 0) return;
    const { queue, originalQueue } = get();
    set({
      queue: [...queue, ...tracks],
      originalQueue: [...originalQueue, ...tracks],
    });
    try {
      await addTracksToEnd(tracks);
    } catch (e) {
      console.warn('[playerStore] appendTracksToQueue failed:', e);
    }
  },

  insertTracksAfterCurrent: async (tracks) => {
    if (tracks.length === 0) return;
    const { queue, originalQueue, currentTrack } = get();
    if (!currentTrack) {
      await get().appendTracksToQueue(tracks);
      return;
    }
    const qIdx = queue.findIndex((t) => t.id === currentTrack.id);
    const insertAt = qIdx >= 0 ? qIdx + 1 : queue.length;
    const newQueue = [
      ...queue.slice(0, insertAt),
      ...tracks,
      ...queue.slice(insertAt),
    ];

    const oIdx = originalQueue.findIndex((t) => t.id === currentTrack.id);
    const oInsert = oIdx >= 0 ? oIdx + 1 : originalQueue.length;
    const newOriginal = [
      ...originalQueue.slice(0, oInsert),
      ...tracks,
      ...originalQueue.slice(oInsert),
    ];
    set({ queue: newQueue, originalQueue: newOriginal });
    try {
      await insertTracksAfterCurrentInPlayer(tracks);
    } catch (e) {
      console.warn('[playerStore] insertTracksAfterCurrent failed:', e);
    }
  },

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setPosition: (pos) => set({ position: pos }),
  setDuration: (dur) => set({ duration: dur }),
  setPlayerVisible: (v) => set({ isPlayerVisible: v }),
}));
