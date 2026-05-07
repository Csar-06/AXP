import * as FileSystem from 'expo-file-system/legacy';
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
  disc?: number | string | null;
  duration?: number;
  picture?: string | null;
};

async function readMetadata(uri: string): Promise<RawMeta> {
  // jsmediatags doesn't support content:// SAF URIs — skip on those, the
  // scanner will fall back to filename-derived title.
  if (isSafUri(uri)) return {};

  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jsmediatags = require('jsmediatags');
      jsmediatags.read(uri, {
        onSuccess(tag: { tags: Record<string, unknown> }) {
          const t = tag.tags;
          const picture = (t.picture as { data?: number[] } | undefined)?.data;
          resolve({
            title: (t.title as string | undefined) ?? undefined,
            artist: (t.artist as string | undefined) ?? undefined,
            album: (t.album as string | undefined) ?? undefined,
            albumArtist:
              ((t.TPE2 as { description?: string })?.description as string | undefined) ??
              undefined,
            genre: (t.genre as string | undefined) ?? undefined,
            year: t.year as number | undefined,
            track: (t.track as string | undefined)
              ? parseInt(t.track as string, 10)
              : undefined,
            picture: picture
              ? `data:image/jpeg;base64,${btoa(String.fromCharCode(...picture))}`
              : null,
          });
        },
        onError() {
          resolve({});
        },
      });
    } catch {
      resolve({});
    }
  });
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

    await db.runAsync(
      `INSERT INTO tracks (
        id, uri, title, artist, album, album_artist, genre, year,
        track_num, disc_num, duration, file_size, format, is_lossless,
        artwork_uri, date_added, date_modified
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,strftime('%s','now'),?)
      ON CONFLICT(uri) DO UPDATE SET
        title=excluded.title, artist=excluded.artist, album=excluded.album,
        album_artist=excluded.album_artist, genre=excluded.genre, year=excluded.year,
        track_num=excluded.track_num, disc_num=excluded.disc_num,
        duration=excluded.duration, file_size=excluded.file_size,
        format=excluded.format, is_lossless=excluded.is_lossless,
        artwork_uri=excluded.artwork_uri, date_modified=excluded.date_modified`,
      [
        id, uri, title, artist, album, albumArtist, genre, year,
        trackNum, discNum, meta.duration ?? 0, size, ext, lossless,
        meta.picture ?? null, Math.floor(mtime),
      ],
    );
    added++;
  }

  // Rebuild aggregates
  await rebuildAggregates();

  // Remove tracks whose files no longer exist
  const allUris = new Set(allFiles);
  const storedRows = await db.getAllAsync<{ uri: string; id: string }>(
    'SELECT uri, id FROM tracks',
  );
  let removed = 0;
  for (const row of storedRows) {
    if (!allUris.has(row.uri)) {
      await db.runAsync('DELETE FROM tracks WHERE id = ?', [row.id]);
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

  // Artists
  await db.execAsync(`
    INSERT INTO artists (id, name, album_count, track_count)
    SELECT
      lower(hex(randomblob(8))) as id,
      artist as name,
      COUNT(DISTINCT album) as album_count,
      COUNT(*) as track_count
    FROM tracks
    GROUP BY artist
  `);

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
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tracks WHERE artist = ? ORDER BY album, COALESCE(track_num,9999), title ASC',
    [artistName],
  );
  return rows.map(rowToTrack);
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
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    artworkUri: r.artwork_uri as string | null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }));
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

export async function createPlaylist(name: string): Promise<string> {
  const db = await getDb();
  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    'INSERT INTO playlists(id, name) VALUES (?, ?)',
    [id, name],
  );
  return id;
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
