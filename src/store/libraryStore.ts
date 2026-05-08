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
} from '@/db/library';

export type LibraryState = {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  genres: Genre[];
  playlists: Playlist[];
  scanPaths: string[];
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScanResult: { added: number; skipped: number; removed: number } | null;
  isLoaded: boolean;

  loadAll: () => Promise<void>;
  scan: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  loadScanPaths: () => Promise<void>;
};

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  scanPaths: [],
  isScanning: false,
  scanProgress: null,
  lastScanResult: null,
  isLoaded: false,

  loadAll: async () => {
    const [tracks, albums, artists, genres, playlists, paths] =
      await Promise.all([
        getAllTracks(),
        getAlbums(),
        getArtists(),
        getGenres(),
        getPlaylists(),
        getScanPaths(),
      ]);
    set({
      tracks,
      albums,
      artists,
      genres,
      playlists,
      scanPaths: paths,
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
  },

  loadScanPaths: async () => {
    const paths = await getScanPaths();
    set({ scanPaths: paths });
  },
}));
