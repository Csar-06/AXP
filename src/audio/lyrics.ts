/**
 * Resolves lyrics for a track from two cached sources, in priority order:
 *   1. A sidecar `.lrc` file discovered and cached during the library scan
 *      (`track.syncedLyrics`, usually time-synced).
 *   2. Embedded lyrics stored on the track (`track.lyrics`).
 *
 * Both are populated at scan time, so this is a pure, synchronous lookup — no
 * filesystem access happens while playing. Format detection (synced vs. plain)
 * is handled downstream by `@/utils/lrc`.
 */
import type { Track } from '@/db/library';

export function getLyricsForTrack(track: Track): string | null {
  const synced = track.syncedLyrics?.trim();
  if (synced) return track.syncedLyrics;
  const embedded = track.lyrics?.trim();
  return embedded ? track.lyrics : null;
}
