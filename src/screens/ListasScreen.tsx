import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@/components/SearchBar';
import { ListHeader } from '@/components/ListHeader';
import { ArtworkImage } from '@/components/ArtworkImage';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { CreatePlaylistModal } from '@/components/CreatePlaylistModal';
import { PlaylistActionSheet } from '@/components/PlaylistActionSheet';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Playlist } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ListasScreen() {
  const [search, setSearch] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [menuPlaylist, setMenuPlaylist] = useState<Playlist | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const playlists = useLibraryStore((s) => s.playlists);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setCreateModalVisible(true)}
            hitSlop={12}
            style={styles.headerPlus}
            accessibilityLabel="Nueva lista"
          >
            <Text style={styles.headerPlusText}>+</Text>
          </Pressable>
          <HeaderSettingsButton />
        </View>
      ),
    });
  }, [navigation]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? playlists.filter((p) => p.name.toLowerCase().includes(q))
      : playlists;
  }, [playlists, search]);

  const handlePress = useCallback(
    (playlist: Playlist) => {
      navigation.navigate('ListaDetail', {
        playlistId: playlist.id,
        playlistName: playlist.name,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        onPress={() => handlePress(item)}
        onLongPress={() => {
          setMenuPlaylist(item);
          setMenuVisible(true);
        }}
        delayLongPress={400}
      >
        <ArtworkImage uri={item.artworkUri} size={52} radius={Radius.sm} />
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    ),
    [handlePress],
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} />
      <ListHeader count={filtered.length} label="listas" />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={68}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
      />
      <CreatePlaylistModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
      <CreatePlaylistModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setEditingPlaylist(null);
        }}
        editingPlaylist={editingPlaylist}
        onUpdated={() => {
          setEditModalVisible(false);
          setEditingPlaylist(null);
        }}
      />
      <PlaylistActionSheet
        visible={menuVisible}
        playlist={menuPlaylist}
        onClose={() => {
          setMenuVisible(false);
          setMenuPlaylist(null);
        }}
        onRequestEdit={(p) => {
          setEditingPlaylist(p);
          setEditModalVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPlus: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerPlusText: {
    fontSize: 28,
    fontWeight: Typography.semibold,
    color: Colors.accent,
    lineHeight: 32,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  pressed: { opacity: 0.6 },
  name: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
});
