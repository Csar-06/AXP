import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@/components/SearchBar';
import { ListHeader } from '@/components/ListHeader';
import { ArtworkImage } from '@/components/ArtworkImage';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Artist } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLUMNS = 3;

export function ArtistasScreen() {
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const artists = useLibraryStore((s) => s.artists);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const avatarSize =
    (width - Spacing.base * 2 - Spacing.md * (COLUMNS - 1)) / COLUMNS;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? artists.filter((a) => a.name.toLowerCase().includes(q))
      : [...artists];
    list.sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return list;
  }, [artists, search, sortAsc]);

  const handlePress = useCallback(
    (artist: Artist) => {
      navigation.navigate('ArtistaDetail', { artistName: artist.name });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Artist; index: number }) => (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { width: avatarSize },
          pressed && styles.pressed,
        ]}
        onPress={() => handlePress(item)}
      >
        <ArtworkImage
          uri={item.artworkUri}
          size={avatarSize}
          radius={Radius.full}
        />
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
      </Pressable>
    ),
    [handlePress, avatarSize],
  );

  return (
    <View style={styles.container}>
      <SearchBar value={search} onChangeText={setSearch} />
      <ListHeader
        count={filtered.length}
        label="artistas"
        sortLabel={sortAsc ? 'A → Z' : 'Z → A'}
        onSortPress={() => setSortAsc((v) => !v)}
      />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        numColumns={COLUMNS}
        estimatedItemSize={avatarSize + 50}
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
  card: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    marginHorizontal: Spacing.xs,
  },
  pressed: { opacity: 0.7 },
  name: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
