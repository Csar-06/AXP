import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('axp.db');
  }
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const newColumns: Array<{ col: string; def: string }> = [
    { col: 'composer',     def: 'ALTER TABLE tracks ADD COLUMN composer     TEXT' },
    { col: 'lyrics',       def: 'ALTER TABLE tracks ADD COLUMN lyrics       TEXT' },
    { col: 'total_tracks', def: 'ALTER TABLE tracks ADD COLUMN total_tracks INTEGER' },
    { col: 'total_discs',  def: 'ALTER TABLE tracks ADD COLUMN total_discs  INTEGER' },
  ];

  const cols = await database.getAllAsync<{ name: string }>(
    "PRAGMA table_info(tracks)",
  );
  const existing = new Set(cols.map((c) => c.name));

  for (const { col, def } of newColumns) {
    if (!existing.has(col)) {
      await database.execAsync(def);
    }
  }
}

export async function initDb(): Promise<void> {
  const database = await getDb();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tracks (
      id          TEXT PRIMARY KEY,
      uri         TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL DEFAULT 'Artista desconocido',
      album       TEXT NOT NULL DEFAULT 'Álbum desconocido',
      album_artist TEXT NOT NULL DEFAULT '',
      genre       TEXT NOT NULL DEFAULT '',
      year        INTEGER,
      track_num   INTEGER,
      disc_num    INTEGER,
      duration    INTEGER NOT NULL DEFAULT 0,
      file_size   INTEGER NOT NULL DEFAULT 0,
      format      TEXT NOT NULL DEFAULT '',
      bitrate     INTEGER,
      sample_rate INTEGER,
      channels    INTEGER,
      is_lossless INTEGER NOT NULL DEFAULT 0,
      artwork_uri TEXT,
      date_added  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      date_modified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS albums (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL DEFAULT '',
      year        INTEGER,
      genre       TEXT NOT NULL DEFAULT '',
      artwork_uri TEXT,
      track_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS artists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      album_count INTEGER NOT NULL DEFAULT 0,
      track_count INTEGER NOT NULL DEFAULT 0,
      artwork_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS genres (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      track_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      artwork_uri TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS scan_paths (
      path        TEXT PRIMARY KEY,
      enabled     INTEGER NOT NULL DEFAULT 1
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
      id,
      title,
      artist,
      album,
      genre,
      content='tracks',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS tracks_fts_insert AFTER INSERT ON tracks BEGIN
      INSERT INTO tracks_fts(rowid, id, title, artist, album, genre)
      VALUES (new.rowid, new.id, new.title, new.artist, new.album, new.genre);
    END;

    CREATE TRIGGER IF NOT EXISTS tracks_fts_delete AFTER DELETE ON tracks BEGIN
      INSERT INTO tracks_fts(tracks_fts, rowid, id, title, artist, album, genre)
      VALUES ('delete', old.rowid, old.id, old.title, old.artist, old.album, old.genre);
    END;

    CREATE TRIGGER IF NOT EXISTS tracks_fts_update AFTER UPDATE ON tracks BEGIN
      INSERT INTO tracks_fts(tracks_fts, rowid, id, title, artist, album, genre)
      VALUES ('delete', old.rowid, old.id, old.title, old.artist, old.album, old.genre);
      INSERT INTO tracks_fts(rowid, id, title, artist, album, genre)
      VALUES (new.rowid, new.id, new.title, new.artist, new.album, new.genre);
    END;

    CREATE INDEX IF NOT EXISTS idx_tracks_artist  ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album   ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_genre   ON tracks(genre);
    CREATE INDEX IF NOT EXISTS idx_tracks_added   ON tracks(date_added DESC);
  `);

  await runMigrations(database);
}
