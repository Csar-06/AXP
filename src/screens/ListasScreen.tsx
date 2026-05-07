import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@/components/SearchBar';
import { ListHeader } from '@/components/ListHeader';
import { ArtworkImage } from '@/components/ArtworkImage';
import { useLibraryStore } from '@/store/libraryStore';
import { createPlaylist } from '@/db/library';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Playlist } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ListasScreen() {
  const [search, setSearch] = useState('');
  const playlists = useLibraryStore((s) => s.playlists);
  const refreshPlaylists = useLibraryStore((s) => s.refreshPlaylists);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? playlists.filter((p) => p.name.toLowerCase().includes(q))
      : playlists;
  }, [playlists, search]);

  const handleCreate = useCallback(() => {
    Alert.prompt(
      'Nueva lista',
      'Nombre de la lista de reproducción',
      async (name) => {
        if (name?.trim()) {
          await createPlaylist(name.trim());
          await refreshPlaylists();
        }
      },
      'plain-text',
    );
  }, [refreshPlaylists]);

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
      <ListHeader
        count={filtered.length}
        label="listas"
        sortLabel="+ Nueva"
        onSortPress={handleCreate}
      />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={68}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
