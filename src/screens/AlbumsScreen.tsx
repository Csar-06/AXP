import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@/components/SearchBar';
import { ListHeader } from '@/components/ListHeader';
import { AlbumCard } from '@/components/AlbumCard';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing } from '@/theme';
import type { Album } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLUMNS = 2;
const CARD_GAP = Spacing.md;

export function AlbumsScreen() {
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const albums = useLibraryStore((s) => s.albums);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const cardWidth = (width - Spacing.base * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? albums.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.artist.toLowerCase().includes(q),
        )
      : [...albums];
    list.sort((a, b) =>
      sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
    );
    return list;
  }, [albums, search, sortAsc]);

  const handlePress = useCallback(
    (album: Album) => {
      navigation.navigate('AlbumDetail', { albumTitle: album.title, albumArtist: album.artist });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Album; index: number }) => (
      <View
        style={[
          styles.cardWrapper,
          { width: cardWidth, marginLeft: index % COLUMNS !== 0 ? CARD_GAP : 0 },
        ]}
      >
        <AlbumCard album={item} onPress={handlePress} width={cardWidth} />
      </View>
    ),
    [handlePress, cardWidth],
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} />
      <ListHeader
        count={filtered.length}
        label="álbumes"
        sortLabel={sortAsc ? 'A → Z' : 'Z → A'}
        onSortPress={() => setSortAsc((v) => !v)}
      />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        numColumns={COLUMNS}
        estimatedItemSize={cardWidth + 50}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          paddingHorizontal: Spacing.base,
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + 8,
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
  cardWrapper: {
    marginBottom: Spacing.lg,
  },
});
