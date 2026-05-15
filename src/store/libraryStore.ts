import { create } from 'zustand';
import type { Track, Album, Artist, Genre, Playlist, ScanProgress } from '@/db/library';
import {
  getAllTracks,
  getAlbums,
  getArtists,
  getGenres,
  getPlaylists,
  scanLibrary,
  getScanPaths,
  getFavoriteTrackIds,
  ensureFavoritosPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from '@/db/library';

export type LibraryState = {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  genres: Genre[];
  playlists: Playlist[];
  scanPaths: string[];
  favoriteTrackIds: Record<string, true>;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanResult: { added: number; skipped: number; removed: number } | null;
  isLoaded: boolean;

  loadAll: () => Promise<void>;
  scan: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
  loadScanPaths: () => Promise<void>;
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  scanPaths: [],
  favoriteTrackIds: {},
  isScanning: false,
  scanProgress: null,
  lastScanResult: null,
  isLoaded: false,

  loadAll: async () => {
    const [tracks, albums, artists, genres, playlists, paths, favIds] =
      await Promise.all([
        getAllTracks(),
        getAlbums(),
        getArtists(),
        getGenres(),
        getPlaylists(),
        getScanPaths(),
        getFavoriteTrackIds(),
      ]);
    const favoriteTrackIds = Object.fromEntries(
      favIds.map((id) => [id, true as const]),
    );
    set({
      tracks,
      albums,
      artists,
      genres,
      playlists,
      scanPaths: paths,
      favoriteTrackIds,
      isLoaded: true,
    });
  },

  scan: async () => {
    set({ isScanning: true, scanProgress: null, lastScanResult: null });
    try {
      const result = await scanLibrary((progress) => {
        set({ scanProgress: progress });
      });
      set({ lastScanResult: result });
      const [tracks, albums, artists, genres] = await Promise.all([
        getAllTracks(),
        getAlbums(),
        getArtists(),
        getGenres(),
      ]);
      set({ tracks, albums, artists, genres });
    } finally {
      set({ isScanning: false, scanProgress: null });
    }
  },

  refreshPlaylists: async () => {
    const playlists = await getPlaylists();
    set({ playlists });
    const favIds = await getFavoriteTrackIds();
    set({
      favoriteTrackIds: Object.fromEntries(
        favIds.map((id) => [id, true as const]),
      ),
    });
  },

  refreshFavorites: async () => {
    const favIds = await getFavoriteTrackIds();
    set({
      favoriteTrackIds: Object.fromEntries(
        favIds.map((id) => [id, true as const]),
      ),
    });
  },

  toggleFavorite: async (trackId: string) => {
    const playlistId = await ensureFavoritosPlaylist();
    const isFav = !!get().favoriteTrackIds[trackId];
    if (isFav) {
      await removeTrackFromPlaylist(playlistId, trackId);
      set((s) => {
        const next = { ...s.favoriteTrackIds };
        delete next[trackId];
        return { favoriteTrackIds: next };
      });
    } else {
      await addTrackToPlaylist(playlistId, trackId);
      set((s) => ({
        favoriteTrackIds: { ...s.favoriteTrackIds, [trackId]: true },
      }));
    }
    const playlists = await getPlaylists();
    set({ playlists });
  },

  loadScanPaths: async () => {
    const paths = await getScanPaths();
    set({ scanPaths: paths });
  },
}));
