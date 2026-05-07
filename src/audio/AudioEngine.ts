import TrackPlayer, {
  State,
  RepeatMode,
  Track as RNTPTrack,
} from 'react-native-track-player';
import { resolvePlaybackUri } from './FFmpegTranscoder';
import type { Track } from '@/db/library';

function toRNTPTrack(track: Track): RNTPTrack {
  return {
    id: track.id,
    url: track.uri,
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.artworkUri ?? undefined,
    duration: track.duration,
  };
}

export async function loadAndPlay(tracks: Track[], startIndex = 0): Promise<void> {
  const resolved = await Promise.all(
    tracks.map(async (t) => {
      const url = await resolvePlaybackUri(t.uri);
      return { ...toRNTPTrack(t), url };
    }),
  );

  await TrackPlayer.reset();
  await TrackPlayer.add(resolved);
  await TrackPlayer.skip(startIndex);
  await TrackPlayer.play();
}

export async function playPause(): Promise<void> {
  const state = (await TrackPlayer.getPlaybackState()).state;
  if (state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    await TrackPlayer.play();
  }
}

export async function seekTo(position: number): Promise<void> {
  await TrackPlayer.seekTo(position);
}

export async function skipToNext(): Promise<void> {
  await TrackPlayer.skipToNext();
}

export async function skipToPrevious(): Promise<void> {
  const pos = await TrackPlayer.getProgress();
  if (pos.position > 3) {
    await TrackPlayer.seekTo(0);
  } else {
    await TrackPlayer.skipToPrevious();
  }
}

export async function setRepeatMode(mode: RepeatMode): Promise<void> {
  await TrackPlayer.setRepeatMode(mode);
}

export async function getRepeatMode(): Promise<RepeatMode> {
  return TrackPlayer.getRepeatMode();
}

/** Fisher-Yates shuffle — returns new shuffled array without mutating input */
export function shuffleTracks<T>(tracks: T[]): T[] {
  const arr = [...tracks];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export async function addToQueue(track: Track): Promise<void> {
  const url = await resolvePlaybackUri(track.uri);
  await TrackPlayer.add({ ...toRNTPTrack(track), url });
}

export async function removeFromQueue(index: number): Promise<void> {
  await TrackPlayer.remove(index);
}
