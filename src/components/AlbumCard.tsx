import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { ArtworkImage } from './ArtworkImage';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import type { Album } from '@/db/library';

type Props = {
  album: Album;
  onPress: (album: Album) => void;
  width: number;
};

export const AlbumCard = React.memo(function AlbumCard({
  album,
  onPress,
  width,
}: Props) {
  const handlePress = useCallback(() => onPress(album), [onPress, album]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <ArtworkImage
        uri={album.artworkUri}
        size={width}
        radius={Radius.md}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {album.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {album.artist}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  info: {
    paddingHorizontal: 2,
    gap: 1,
  },
  title: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  artist: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
});
