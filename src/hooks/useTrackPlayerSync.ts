/**
 * Listens to TrackPlayer events and keeps playerStore + themeStore in sync.
 * Call once at app root.
 */
import { useEffect } from 'react';
import TrackPlayer, {
  Event,
  State,
  useTrackPlayerEvents,
  useProgress,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';
import { usePlayerStore } from '@/store/playerStore';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';

const WATCHED_EVENTS = [
  Event.PlaybackActiveTrackChanged,
  Event.PlaybackState,
];

export function useTrackPlayerSync() {
  const setCurrentTrack = usePlayerStore((s) => s.setCurrentTrack);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const queue = usePlayerStore((s) => s.queue);
  const setFromImage = useThemeStore((s) => s.setFromImage);
  const resetTheme = useThemeStore((s) => s.reset);
  const dynamicTheming = useSettingsStore((s) => s.dynamicTheming);

  const { position, duration } = useProgress(500);
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();

  // Sync position/duration
  useEffect(() => {
    setPosition(position);
  }, [position, setPosition]);

  useEffect(() => {
    setDuration(duration);
  }, [duration, setDuration]);

  // Sync play state
  useEffect(() => {
    setIsPlaying(playbackState.state === State.Playing);
  }, [playbackState.state, setIsPlaying]);

  // Sync active track & update theme
  useEffect(() => {
    if (!activeTrack) return;
    const match = queue.find((t) => t.id === activeTrack.id) ?? null;
    setCurrentTrack(match);
    if (dynamicTheming) {
      setFromImage(match?.artworkUri ?? null);
    } else {
      resetTheme();
    }
  }, [activeTrack, queue, setCurrentTrack, setFromImage, resetTheme, dynamicTheming]);
}
