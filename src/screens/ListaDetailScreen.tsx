import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Text,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TrackRow } from '@/components/TrackRow';
import { CreatePlaylistModal } from '@/components/CreatePlaylistModal';
import {
  PlaylistActionSheet,
  type PlaylistSortMode,
} from '@/components/PlaylistActionSheet';
import { usePlayerStore } from '@/store/playerStore';
import { getPlaylistTracks, getPlaylistById } from '@/db/library';
import type { Track, Playlist } from '@/db/library';
import { Colors, Spacing, Typography } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListaDetail'>;

function sortTracks(tracks: Track[], mode: PlaylistSortMode): Track[] {
  const copy = [...tracks];
  switch (mode) {
    case 'playlist':
      return copy;
    case 'title':
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      );
    case 'artist':
      return copy.sort((a, b) =>
        a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' }),
      );
    case 'album':
      return copy.sort((a, b) =>
        a.album.localeCompare(b.album, undefined, { sensitivity: 'base' }),
      );
    default:
      return copy;
  }
}

export function ListaDetailScreen({ route, navigation }: Props) {
  const { playlistId, playlistName } = route.params;
  const [baseTracks, setBaseTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<PlaylistSortMode>('playlist');
  const [menuVisible, setMenuVisible] = useState(false);
  const [sheetPlaylist, setSheetPlaylist] = useState<Playlist | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const insets = useSafeAreaInsets();

  const displayTracks = useMemo(
    () => sortTracks(baseTracks, sortMode),
    [baseTracks, sortMode],
  );

  const reload = useCallback(async () => {
    const t = await getPlaylistTracks(playlistId);
    setBaseTracks(t);
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openPlaylistMenu = useCallback(async () => {
    const p = await getPlaylistById(playlistId);
    if (p) {
      setSheetPlaylist(p);
      setMenuVisible(true);
    }
  }, [playlistId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openPlaylistMenu}
          hitSlop={14}
          style={{ paddingHorizontal: Spacing.md }}
        >
          <Text style={styles.headerMore}>···</Text>
        </Pressable>
      ),
    });
  }, [navigation, openPlaylistMenu]);

  const handlePressTrack = useCallback(
    (t: Track) => {
      const idx = displayTracks.findIndex((x) => x.id === t.id);
      play(displayTracks, idx >= 0 ? idx : 0);
    },
    [play, displayTracks],
  );

  const handleRequestEdit = useCallback(async (playlist: Playlist) => {
    const fresh = await getPlaylistById(playlist.id);
    setEditingPlaylist(fresh ?? playlist);
    setEditModalVisible(true);
  }, []);

  const handleUpdated = useCallback(async () => {
    setEditModalVisible(false);
    setEditingPlaylist(null);
    await reload();
    const p = await getPlaylistById(playlistId);
    if (p && p.name !== playlistName) {
      navigation.setParams({ playlistName: p.name });
    }
  }, [playlistId, playlistName, navigation, reload]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Track>) => (
      <TrackRow
        track={item}
        onPress={handlePressTrack}
        isActive={item.id === currentTrack?.id}
      />
    ),
    [handlePressTrack, currentTrack?.id],
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayTracks}
        renderItem={renderItem}
        keyExtractor={(t) => t.id}
        extraData={`${sortMode}-${displayTracks.length}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />
      <PlaylistActionSheet
        visible={menuVisible}
        playlist={sheetPlaylist}
        onClose={() => {
          setMenuVisible(false);
          setSheetPlaylist(null);
        }}
        onRequestEdit={handleRequestEdit}
        onDeleted={() => navigation.goBack()}
        showSortOptions
        sortMode={sortMode}
        onSortChange={setSortMode}
      />
      <CreatePlaylistModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditingPlaylist(null);
        }}
        editingPlaylist={editingPlaylist}
        onUpdated={handleUpdated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerMore: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: Typography.bold,
  },
});
