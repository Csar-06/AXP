import * as FileSystem from 'expo-file-system/legacy';
import { readAudioMetadata } from 'expo-audio-metadata';
import { getDb } from './schema';

export type Track = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: number | null;
  trackNum: number | null;
  discNum: number | null;
  totalTracks: number | null;
  totalDiscs: number | null;
  composer: string | null;
  lyrics: string | null;
  duration: number;
  fileSize: number;
  format: string;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  isLossless: boolean;
  artworkUri: string | null;
  dateAdded: number;
  dateModified: number;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  genre: string;
  artworkUri: string | null;
  trackCount: number;
};

export type Artist = {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  artworkUri: string | null;
};

export type Genre = {
  id: string;
  name: string;
  trackCount: number;
};

export type Playlist = {
  id: string;
  name: string;
  artworkUri: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
};

const SUPPORTED_EXTENSIONS = [
  '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus',
  '.wav', '.aiff', '.aif', '.alac', '.wma', '.ape',
];

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

const losslessFormats = ['.flac', '.alac', '.wav', '.aiff', '.aif', '.ape'];
function isLossless(name: string): boolean {
  const lower = name.toLowerCase();
  return losslessFormats.some((ext) => lower.endsWith(ext));
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, '-');
}

function makeId(...parts: string[]): string {
  return parts.map(slugify).join('::');
}

// ── Artwork persistence ────────────────────────────────────────────────────────
// Embedded cover art comes from the native module as a base64 `data:` URI.
// Storing those strings directly in SQLite blew the JS heap on boot (loadAll
// with SELECT * materialised every blob into memory). Instead, we write the
// decoded bytes to a cache file once during scan and store only its URI.

const ARTWORK_DIR = `${FileSystem.cacheDirectory ?? ''}artwork`;
const PLAYLIST_COVER_DIR = `${ARTWORK_DIR}/playlist-covers`;
let artworkDirReady = false;
let playlistCoverDirReady = false;

async function ensureArtworkDir(): Promise<void> {
  if (artworkDirReady) return;
  try {
    const info = await FileSystem.getInfoAsync(ARTWORK_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(ARTWORK_DIR, { intermediates: true });
    }
    artworkDirReady = true;
  } catch {
    // Cache may be unavailable in some environments — fall back to no-op
    // persistence; the column simply stays null.
  }
}

function safeArtworkBasename(trackId: string): string {
  return trackId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function extFromMime(mime: string): string {
  if (mime.includes('png'))  return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif'))  return 'gif';
  return 'jpg';
}

async function ensurePlaylistCoverDir(): Promise<void> {
  if (playlistCoverDirReady) return;
  await ensureArtworkDir();
  if (!artworkDirReady) return;
  try {
    const info = await FileSystem.getInfoAsync(PLAYLIST_COVER_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(PLAYLIST_COVER_DIR, {
        intermediates: true,
      });
    }
    playlistCoverDirReady = true;
  } catch {
    playlistCoverDirReady = false;
  }
}

/** Copy a gallery / picker image into app cache; returns stable `file://` URI. */
export async function persistPlaylistCoverFromPick(
  sourceUri: string,
): Promise<string | null> {
  if (!sourceUri?.trim()) return null;
  await ensurePlaylistCoverDir();
  if (!playlistCoverDirReady) return null;
  const extMatch = /\.(jpe?g|png|webp|gif)$/i.exec(sourceUri);
  const raw = extMatch?.[1]?.toLowerCase() ?? 'jpg';
  const ext = raw === 'jpeg' ? 'jpg' : raw;
  const dest = `${PLAYLIST_COVER_DIR}/pl-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    return null;
  }
}

/**
 * Decode a `data:image/...;base64,...` URI into a cache file and return the
 * `file://` URI to it. Returns null when the input is not a recognisable data
 * URI or the write fails.
 */
async function persistArtwork(
  trackId: string,
  dataUri: string | null | undefined,
): Promise<string | null> {
  if (!dataUri) return null;
  // Pass-through if already a file/content URI (e.g. from a previous scan).
  if (!dataUri.startsWith('data:')) return dataUri;

  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri);
  if (!match) return null;

  await ensureArtworkDir();
  if (!artworkDirReady) return null;

  const ext = extFromMime(match[1] ?? 'image/jpeg');
  const fileUri = `${ARTWORK_DIR}/${safeArtworkBasename(trackId)}.${ext}`;
  try {
    await FileSystem.writeAsStringAsync(fileUri, match[2] ?? '', {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  } catch {
    return null;
  }
}

export async function getScanPaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ path: string }>(
    'SELECT path FROM scan_paths WHERE enabled = 1',
  );
  return rows.map((r) => r.path);
}

export async function addScanPath(path: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO scan_paths(path, enabled) VALUES (?, 1)',
    [path],
  );
}

export async function removeScanPath(path: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM scan_paths WHERE path = ?', [path]);
}

function isSafUri(p: string): boolean {
  return p.startsWith('content://');
}

/**
 * Extract a filename (with extension) from a SAF child URI.
 * Example:
 *   content://...documents/tree/primary%3AMusic/document/primary%3AMusic%2Fsong.mp3
 *   → "song.mp3"
 */
function getSafBasename(uri: string): string {
  try {
    // SAF children encode the document id after `/document/`. Within that id,
    // path segments are encoded as `%2F` (/). The last segment is the filename.
    const docMarker = '/document/';
    const idx = uri.indexOf(docMarker);
    const docId = idx >= 0
      ? decodeURIComponent(uri.substring(idx + docMarker.length))
      : decodeURIComponent(uri);
    const lastSep = Math.max(docId.lastIndexOf('/'), docId.lastIndexOf(':'));
    return lastSep >= 0 ? docId.substring(lastSep + 1) : docId;
  } catch {
    return uri;
  }
}

function hasFileExtension(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 && dot >= name.length - 6;
}

async function collectAudioFilesPosix(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await FileSystem.readDirectoryAsync(dir);
    for (const entry of entries) {
      const fullPath = `${dir}/${entry}`;
      const info = await FileSystem.getInfoAsync(fullPath);
      if (info.isDirectory) {
        results.push(...(await collectAudioFilesPosix(fullPath)));
      } else if (isAudioFile(entry)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory not accessible — skip silently
  }
  return results;
}

async function collectAudioFilesSaf(dirUri: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(
      dirUri,
    );
    for (const childUri of children) {
      const name = getSafBasename(childUri);
      if (!hasFileExtension(name)) {
        // Treat as subdirectory — SAF child URIs for folders look identical
        // to file URIs, so we use the "no extension" heuristic and recurse.
        results.push(...(await collectAudioFilesSaf(childUri)));
      } else if (isAudioFile(name)) {
        results.push(childUri);
      }
    }
  } catch {
    // Permission revoked or invalid URI — skip silently
  }
  return results;
}

async function collectAudioFiles(dir: string): Promise<string[]> {
  return isSafUri(dir)
    ? collectAudioFilesSaf(dir)
    : collectAudioFilesPosix(dir);
}

type RawMeta = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number | string | null;
  track?: number | string | null;
  totalTracks?: number | null;
  disc?: number | string | null;
  totalDiscs?: number | null;
  composer?: string | null;
  lyrics?: string | null;
  duration?: number;
  bitrate?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  picture?: string | null;
};

function parseSlashNum(raw: string | undefined, idx: 0 | 1): number | null {
  if (!raw) return null;
  const part = raw.split('/')[idx];
  const n = parseInt(part ?? '', 10);
  return isNaN(n) ? null : n;
}

/**
 * Read metadata via jsmediatags — used only to extract USLT lyrics on
 * non-SAF paths on Android, where the native module doesn't expose them.
 */
async function readLyricsJsmediatags(uri: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jsmediatags = require('jsmediatags');
      jsmediatags.read(uri, {
        onSuccess(tag: { tags: Record<string, unknown> }) {
          const uslt = tag.tags.USLT as { text?: string } | undefined;
          resolve(uslt?.text ?? null);
        },
        onError() {
          resolve(null);
        },
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Primary metadata reader: uses the native expo-audio-metadata module which
 * calls MediaMetadataRetriever on Android and AVFoundation on iOS.
 *
 * - Supports both POSIX file paths and SAF (content://) URIs on Android.
 * - For lyrics on Android (not exposed by MediaMetadataRetriever), falls back
 *   to jsmediatags on non-SAF files.
 */
async function readMetadata(uri: string): Promise<RawMeta> {
  try {
    const native = await readAudioMetadata(uri);

    const track       = parseSlashNum(native.trackNumber, 0);
    const totalTracks = parseSlashNum(native.trackNumber, 1);
    const disc        = parseSlashNum(native.discNumber, 0);
    const totalDiscs  = parseSlashNum(native.discNumber, 1);

    // duration from native is in ms → convert to seconds for storage
    const duration = native.duration != null ? native.duration / 1000 : undefined;

    const base: RawMeta = {
      title:       native.title,
      artist:      native.artist,
      album:       native.album,
      albumArtist: native.albumArtist,
      genre:       native.genre,
      year:        native.year != null ? parseInt(native.year, 10) : undefined,
      composer:    native.composer ?? null,
      track,
      totalTracks,
      disc,
      totalDiscs,
      duration,
      bitrate:     native.bitrate ?? null,
      sampleRate:  native.sampleRate ?? null,
      channels:    native.channels ?? null,
      picture:     native.artworkBase64 ?? null,
    };

    // iOS exposes lyrics natively; on Android they are absent from the native
    // module — fall back to jsmediatags for non-SAF paths only.
    if (native.lyrics) {
      base.lyrics = native.lyrics;
    } else if (!isSafUri(uri)) {
      base.lyrics = await readLyricsJsmediatags(uri);
    }

    return base;
  } catch {
    // Native module unavailable (e.g. running in a test environment) or the
    // file could not be opened. Return empty so the scanner uses fallback values.
    return {};
  }
}

function getBasename(uri: string): string {
  if (isSafUri(uri)) return getSafBasename(uri);
  const parts = uri.split('/');
  return parts[parts.length - 1] ?? uri;
}

function filenameToTitle(uri: string): string {
  return getBasename(uri).replace(/\.[^.]+$/, '');
}

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

export type ScanProgress = {
  total: number;
  processed: number;
  current: string;
};

export async function scanLibrary(
  onProgress?: (p: ScanProgress) => void,
): Promise<{ added: number; skipped: number; removed: number }> {
  const db = await getDb();
  const paths = await getScanPaths();
  if (paths.length === 0) return { added: 0, skipped: 0, removed: 0 };

  const allFiles: string[] = [];
  for (const p of paths) {
    const files = await collectAudioFiles(p);
    allFiles.push(...files);
  }

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const uri = allFiles[i]!;
    onProgress?.({ total: allFiles.length, processed: i, current: uri });

    let mtime = 0;
    let size = 0;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      mtime = (info as { modificationTime?: number }).modificationTime ?? 0;
      size = (info as { size?: number }).size ?? 0;
    } catch {
      // SAF URIs may not return file info — proceed with zeros so we still
      // index the track. The next scan will re-process if the URI is unchanged.
    }

    const existing = await db.getFirstAsync<{ date_modified: number }>(
      'SELECT date_modified FROM tracks WHERE uri = ?',
      [uri],
    );

    if (existing && mtime > 0 && existing.date_modified >= Math.floor(mtime)) {
      skipped++;
      continue;
    }

    const meta = await readMetadata(uri);
    const filename = getBasename(uri);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const title = meta.title || filenameToTitle(filename);
    const artist = meta.artist || 'Artista desconocido';
    const album = meta.album || 'Álbum desconocido';
    const albumArtist = meta.albumArtist || artist;
    const genre = meta.genre || '';
    const year = toNum(meta.year);
    const trackNum = toNum(meta.track);
    const discNum = toNum(meta.disc);
    const lossless = isLossless(filename) ? 1 : 0;
    const id = makeId(uri);
    const artworkUri = await persistArtwork(id, meta.picture);

    await db.runAsync(
      `INSERT INTO tracks (
        id, uri, title, artist, album, album_artist, genre, year,
        track_num, disc_num, total_tracks, total_discs, composer, lyrics,
        duration, file_size, format, bitrate, sample_rate, channels, is_lossless,
        artwork_uri, date_added, date_modified
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,strftime('%s','now'),?)
      ON CONFLICT(uri) DO UPDATE SET
        title=excluded.title, artist=excluded.artist, album=excluded.album,
        album_artist=excluded.album_artist, genre=excluded.genre, year=excluded.year,
        track_num=excluded.track_num, disc_num=excluded.disc_num,
        total_tracks=excluded.total_tracks, total_discs=excluded.total_discs,
        composer=excluded.composer, lyrics=excluded.lyrics,
        duration=excluded.duration, file_size=excluded.file_size,
        format=excluded.format, bitrate=excluded.bitrate,
        sample_rate=excluded.sample_rate, channels=excluded.channels,
        is_lossless=excluded.is_lossless,
        artwork_uri=excluded.artwork_uri, date_modified=excluded.date_modified`,
      [
        id, uri, title, artist, album, albumArtist, genre, year,
        trackNum, discNum, meta.totalTracks ?? null, meta.totalDiscs ?? null,
        meta.composer ?? null, meta.lyrics ?? null,
        meta.duration ?? 0, size, ext,
        meta.bitrate ?? null, meta.sampleRate ?? null, meta.channels ?? null,
        lossless,
        artworkUri, Math.floor(mtime),
      ],
    );
    added++;
  }

  // Rebuild aggregates
  await rebuildAggregates();

  // Remove tracks whose files no longer exist
  const allUris = new Set(allFiles);
  const storedRows = await db.getAllAsync<{
    uri: string;
    id: string;
    artwork_uri: string | null;
  }>('SELECT uri, id, artwork_uri FROM tracks');
  let removed = 0;
  for (const row of storedRows) {
    if (!allUris.has(row.uri)) {
      await db.runAsync('DELETE FROM tracks WHERE id = ?', [row.id]);
      if (row.artwork_uri && row.artwork_uri.startsWith(ARTWORK_DIR)) {
        try {
          await FileSystem.deleteAsync(row.artwork_uri, { idempotent: true });
        } catch {
          // Best-effort cleanup; cache will be reclaimed by Android otherwise.
        }
      }
      removed++;
    }
  }

  return { added, skipped, removed };
}

async function rebuildAggregates(): Promise<void> {
  const db = await getDb();

  await db.execAsync('DELETE FROM albums; DELETE FROM artists; DELETE FROM genres;');

  // Albums
  await db.execAsync(`
    INSERT INTO albums (id, title, artist, year, genre, artwork_uri, track_count)
    SELECT
      lower(hex(randomblob(8))) as id,
      album as title,
      COALESCE(NULLIF(album_artist,''), artist) as artist,
      year,
      genre,
      (SELECT artwork_uri FROM tracks t2
        WHERE t2.album = t.album AND t2.artist = t.artist
        AND t2.artwork_uri IS NOT NULL LIMIT 1) as artwork_uri,
      COUNT(*) as track_count
    FROM tracks t
    GROUP BY album, COALESCE(NULLIF(album_artist,''), artist)
  `);

  // Artists — split multi-artist tags (e.g. "Yeat, Gunna") into individual rows
  const allTrackRows = await db.getAllAsync<{ artist: string; album: string }>(
    'SELECT artist, album FROM tracks',
  );

  const artistMap = new Map<string, { albums: Set<string>; trackCount: number }>();

  for (const row of allTrackRows) {
    for (const name of splitArtists(row.artist)) {
      const entry = artistMap.get(name) ?? { albums: new Set<string>(), trackCount: 0 };
      entry.albums.add(row.album);
      entry.trackCount += 1;
      artistMap.set(name, entry);
    }
  }

  for (const [name, { albums, trackCount }] of artistMap) {
    await db.runAsync(
      `INSERT INTO artists (id, name, album_count, track_count) VALUES (lower(hex(randomblob(8))), ?, ?, ?)`,
      [name, albums.size, trackCount],
    );
  }

  // Genres
  await db.execAsync(`
    INSERT INTO genres (id, name, track_count)
    SELECT
      lower(hex(randomblob(8))) as id,
      genre as name,
      COUNT(*) as track_count
    FROM tracks
    WHERE genre != ''
    GROUP BY genre
  `);
}

// ── Query helpers ──────────────────────────────────────────────────────────────

/**
 * Splits a raw artist string (e.g. "Yeat, Gunna" or "Yeat; Gunna") into
 * individual artist names, trimming whitespace and discarding empty tokens.
 */
function splitArtists(artist: string): string[] {
  return artist
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

function rowToTrack(r: Record<string, unknown>): Track {
  return {
    id: r.id as string,
    uri: r.uri as string,
    title: r.title as string,
    artist: r.artist as string,
    album: r.album as string,
    albumArtist: r.album_artist as string,
    genre: r.genre as string,
    year: r.year as number | null,
    trackNum: r.track_num as number | null,
    discNum: r.disc_num as number | null,
    totalTracks: r.total_tracks as number | null,
    totalDiscs: r.total_discs as number | null,
    composer: r.composer as string | null,
    lyrics: r.lyrics as string | null,
    duration: r.duration as number,
    fileSize: r.file_size as number,
    format: r.format as string,
    bitrate: r.bitrate as number | null,
    sampleRate: r.sample_rate as number | null,
    channels: r.channels as number | null,
    isLossless: Boolean(r.is_lossless),
    artworkUri: r.artwork_uri as string | null,
    dateAdded: r.date_added as number,
    dateModified: r.date_modified as number,
  };
}

export async function getAllTracks(
  search?: string,
  sort: 'title' | 'artist' | 'date_added' = 'title',
): Promise<Track[]> {
  const db = await getDb();
  if (search && search.trim().length > 0) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT t.* FROM tracks t
       JOIN tracks_fts fts ON t.rowid = fts.rowid
       WHERE tracks_fts MATCH ?
       ORDER BY t.${sort} ASC`,
      [`${search.trim()}*`],
    );
    return rows.map(rowToTrack);
  }
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tracks ORDER BY ${sort} ASC`,
  );
  return rows.map(rowToTrack);
}

export async function getAlbums(search?: string): Promise<Album[]> {
  const db = await getDb();
  const rows = search?.trim()
    ? await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM albums WHERE title LIKE ? OR artist LIKE ? ORDER BY title ASC`,
        [`%${search}%`, `%${search}%`],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM albums ORDER BY title ASC',
      );
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    artist: r.artist as string,
    year: r.year as number | null,
    genre: r.genre as string,
    artworkUri: r.artwork_uri as string | null,
    trackCount: r.track_count as number,
  }));
}

export async function getAlbumTracks(albumTitle: string): Promise<Track[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tracks WHERE album = ?
     ORDER BY COALESCE(disc_num, 1), COALESCE(track_num, 9999), title ASC`,
    [albumTitle],
  );
  return rows.map(rowToTrack);
}

export async function getArtists(search?: string): Promise<Artist[]> {
  const db = await getDb();
  const rows = search?.trim()
    ? await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM artists WHERE name LIKE ? ORDER BY name ASC',
        [`%${search}%`],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM artists ORDER BY name ASC',
      );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    albumCount: r.album_count as number,
    trackCount: r.track_count as number,
    artworkUri: r.artwork_uri as string | null,
  }));
}

export async function getArtistTracks(artistName: string): Promise<Track[]> {
  const db = await getDb();
  // Fetch candidates via LIKE patterns to cover multi-artist strings, then
  // filter precisely in JS with splitArtists to avoid false positives.
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tracks
     WHERE artist = ?
        OR artist LIKE ?
        OR artist LIKE ?
        OR artist LIKE ?
        OR artist LIKE ?
     ORDER BY album, COALESCE(track_num,9999), title ASC`,
    [
      artistName,
      `${artistName},%`,   // starts: "Yeat, Gunna"
      `${artistName};%`,   // starts: "Yeat; Gunna"
      `%, ${artistName}%`, // ends or middle: "Gunna, Yeat"
      `%; ${artistName}%`, // ends or middle: "Gunna; Yeat"
    ],
  );
  return rows
    .map(rowToTrack)
    .filter((t) => splitArtists(t.artist).includes(artistName));
}

export async function getGenres(search?: string): Promise<Genre[]> {
  const db = await getDb();
  const rows = search?.trim()
    ? await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM genres WHERE name LIKE ? ORDER BY name ASC',
        [`%${search}%`],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM genres ORDER BY name ASC',
      );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    trackCount: r.track_count as number,
  }));
}

export async function getGenreTracks(genreName: string): Promise<Track[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tracks WHERE genre = ? ORDER BY title ASC',
    [genreName],
  );
  return rows.map(rowToTrack);
}

export async function getPlaylists(search?: string): Promise<Playlist[]> {
  const db = await getDb();
  const rows = search?.trim()
    ? await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM playlists WHERE name LIKE ? ORDER BY name ASC',
        [`%${search}%`],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM playlists ORDER BY name ASC',
      );
  return rows.map(rowToPlaylist);
}

function rowToPlaylist(r: Record<string, unknown>): Playlist {
  return {
    id: r.id as string,
    name: r.name as string,
    artworkUri: r.artwork_uri as string | null,
    description: (r.description as string | null | undefined) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  };
}

export async function getPlaylistById(
  id: string,
): Promise<Playlist | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM playlists WHERE id = ? LIMIT 1',
    [id],
  );
  return row ? rowToPlaylist(row) : null;
}

export async function updatePlaylist(
  id: string,
  fields: {
    name: string;
    artworkUri: string | null;
    description: string | null;
  },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE playlists SET name = ?, artwork_uri = ?, description = ?,
      updated_at = strftime('%s','now') WHERE id = ?`,
    [
      fields.name.trim(),
      fields.artworkUri,
      fields.description?.trim() ? fields.description.trim() : null,
      id,
    ],
  );
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT t.* FROM tracks t
     JOIN playlist_tracks pt ON t.id = pt.track_id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position ASC`,
    [playlistId],
  );
  return rows.map(rowToTrack);
}

/** Exact display name match (e.g. system playlist “Favoritos”). */
export async function getPlaylistIdByExactName(
  name: string,
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM playlists WHERE name = ? LIMIT 1',
    [name],
  );
  return row?.id ?? null;
}

/** Track IDs in the playlist whose name matches exactly `"Favoritos"`. */
export async function getFavoriteTrackIds(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ track_id: string }>(
    `SELECT pt.track_id FROM playlist_tracks pt
     INNER JOIN playlists p ON p.id = pt.playlist_id
     WHERE p.name = ?`,
    ['Favoritos'],
  );
  return rows.map((r) => r.track_id);
}

export type CreatePlaylistOptions = {
  artworkUri?: string | null;
  description?: string | null;
};

export async function createPlaylist(
  name: string,
  opts?: CreatePlaylistOptions,
): Promise<string> {
  const db = await getDb();
  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const artworkUri = opts?.artworkUri ?? null;
  const description =
    opts?.description?.trim() ? opts.description.trim() : null;
  await db.runAsync(
    'INSERT INTO playlists(id, name, artwork_uri, description) VALUES (?,?,?,?)',
    [id, name, artworkUri, description],
  );
  return id;
}

export async function ensureFavoritosPlaylist(): Promise<string> {
  const existing = await getPlaylistIdByExactName('Favoritos');
  if (existing) return existing;
  return createPlaylist('Favoritos');
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  const db = await getDb();
  const maxRow = await db.getFirstAsync<{ pos: number | null }>(
    'SELECT MAX(position) as pos FROM playlist_tracks WHERE playlist_id = ?',
    [playlistId],
  );
  const pos = (maxRow?.pos ?? -1) + 1;
  await db.runAsync(
    'INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES (?,?,?)',
    [playlistId, trackId, pos],
  );
  await db.runAsync(
    'UPDATE playlists SET updated_at = strftime(\'%s\',\'now\') WHERE id = ?',
    [playlistId],
  );
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
    [playlistId, trackId],
  );
}

export async function reorderPlaylist(
  playlistId: string,
  orderedTrackIds: string[],
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedTrackIds.length; i++) {
      await db.runAsync(
        'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?',
        [i, playlistId, orderedTrackIds[i]!],
      );
    }
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [playlistId]);
}
