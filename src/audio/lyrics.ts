/**
 * Resolves lyrics for a track from two cached sources:
 *   - `track.lyrics`       — embedded lyrics read from the file's tags at scan.
 *   - `track.syncedLyrics` — a sidecar `.lrc` file cached at scan (often synced).
 *
 * Both are populated at scan time, so this is a pure, synchronous lookup — no
 * filesystem access happens while playing. The `source` preference decides
 * which is used; `auto` prefers embedded metadata, then falls back to `.lrc`.
 * Format detection (synced vs. plain) is handled downstream by `@/utils/lrc`.
 */
import type { Track } from '@/db/library';
import type { LyricsSource } from '@/store/settingsStore';

export function getLyricsForTrack(
  track: Track,
  source: LyricsSource = 'auto',
): string | null {
  const embedded = track.lyrics?.trim() ? track.lyrics : null;
  const lrc = track.syncedLyrics?.trim() ? track.syncedLyrics : null;

  switch (source) {
    case 'metadata':
      return embedded;
    case 'lrc':
      return lrc;
    case 'auto':
    default:
      // Priority: 1) embedded metadata, 2) sidecar .lrc file.
      return embedded ?? lrc;
  }
}
