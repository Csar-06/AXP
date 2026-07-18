/**
 * LRC / plain-text lyrics parsing.
 *
 * Supports:
 *  - Synced LRC with one or more `[mm:ss.xx]` timestamps per line (karaoke).
 *  - `[offset:±ms]` global shift.
 *  - Plain-text lyrics (e.g. embedded USLT) with no timestamps.
 *
 * Metadata tags (`[ar:]`, `[ti:]`, `[al:]`, …) are stripped from output.
 */

export type LyricLine = {
  /** Playback time in seconds when this line becomes active, or null if unsynced. */
  time: number | null;
  text: string;
};

export type ParsedLyrics = {
  /** True when at least one line carries a timestamp (enables karaoke highlight). */
  synced: boolean;
  lines: LyricLine[];
};

// [mm:ss], [mm:ss.xx] or [mm:ss:xx]
const TIME_TAG = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
// Non-timestamp metadata tags we drop entirely.
const META_TAG = /^\[(ar|ti|al|au|by|re|ve|length|offset|id|hash):.*\]$/i;

export function parseLyrics(raw: string): ParsedLyrics {
  const rawLines = raw.replace(/\r\n?/g, '\n').split('\n');

  // Offset in seconds. LRC convention: a positive `[offset:+ms]` makes lyrics
  // appear earlier, so it is subtracted from each timestamp.
  let offset = 0;
  const timed: LyricLine[] = [];
  let anyTimed = false;

  for (const line of rawLines) {
    const offsetMatch = /^\s*\[offset:\s*([+-]?\d+)\s*\]/i.exec(line);
    if (offsetMatch) {
      offset = parseInt(offsetMatch[1]!, 10) / 1000;
      continue;
    }

    TIME_TAG.lastIndex = 0;
    const times: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(line)) !== null) {
      const min = parseInt(m[1]!, 10);
      const sec = parseInt(m[2]!, 10);
      const fracRaw = m[3] ?? '';
      const frac = fracRaw ? parseInt(fracRaw, 10) / 10 ** fracRaw.length : 0;
      times.push(min * 60 + sec + frac);
    }

    if (times.length > 0) {
      anyTimed = true;
      const text = line.replace(TIME_TAG, '').trim();
      for (const t of times) timed.push({ time: t, text });
    }
  }

  if (anyTimed) {
    const lines = timed
      .map((l) => ({ time: (l.time as number) - offset, text: l.text }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    return { synced: true, lines };
  }

  // No timestamps anywhere → plain text. Keep every line (including blanks for
  // stanza spacing) but drop metadata tags.
  const lines = rawLines
    .filter((l) => !META_TAG.test(l.trim()))
    .map((l) => ({ time: null, text: l }));
  return { synced: false, lines };
}

/**
 * Index of the line that should be highlighted at `position` (seconds), or -1
 * before the first timed line. `lines` must be sorted ascending by time.
 */
export function activeLineIndex(lines: LyricLine[], position: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.time;
    if (t == null) continue;
    // Small lead so the line lights up just as it is sung.
    if (t <= position + 0.2) idx = i;
    else break;
  }
  return idx;
}
