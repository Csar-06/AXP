export type RootStackParamList = {
  Tabs: undefined;
  AlbumDetail: { albumTitle: string; albumArtist: string };
  ArtistaDetail: { artistName: string };
  GeneroDetail: { genreName: string };
  ListaDetail: { playlistId: string; playlistName: string };
  FullPlayer: undefined;
  QueueView: undefined;
  ScanSettings: undefined;
};

export type TabParamList = {
  Pistas: undefined;
  Generos: undefined;
  Albums: undefined;
  Artistas: undefined;
  Listas: undefined;
};
