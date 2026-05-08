import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchBar } from '@/components/SearchBar';
import { ListHeader } from '@/components/ListHeader';
import { useLibraryStore } from '@/store/libraryStore';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Genre } from '@/db/library';
import type { RootStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GenerosScreen() {
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const genres = useLibraryStore((s) => s.genres);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? genres.filter((g) => g.name.toLowerCase().includes(q))
      : [...genres];
    list.sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
    return list;
  }, [genres, search, sortAsc]);

  const handlePress = useCallback(
    (genre: Genre) => {
      navigation.navigate('GeneroDetail', { genreName: genre.name });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Genre }) => (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        onPress={() => handlePress(item)}
      >
        <View style={styles.itemInner}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.count}>{item.trackCount} pistas</Text>
        </View>
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
        label="géneros"
        sortLabel={sortAsc ? 'A → Z' : 'Z → A'}
        onSortPress={() => setSortAsc((v) => !v)}
      />
      <FlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={56}
        keyExtractor={(g) => g.id}
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
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  pressed: { opacity: 0.6 },
  itemInner: { flex: 1 },
  name: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  count: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
});
