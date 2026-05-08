import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { ArtworkImage } from './ArtworkImage';
import { Colors, Spacing, Typography, Radius } from '@/theme';
import { usePlayerStore } from '@/store/playerStore';

type Props = {
  onPress: () => void;
};

export function MiniPlayer({ onPress }: Props) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const next = usePlayerStore((s) => s.next);

  const opacity = useRef(new Animated.Value(currentTrack ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: currentTrack ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentTrack, opacity]);

  if (!currentTrack) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Pressable style={styles.inner} onPress={onPress}>
        <ArtworkImage
          uri={currentTrack.artworkUri}
          size={40}
          radius={Radius.sm}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            hitSlop={10}
            style={styles.controlBtn}
          >
            <Text style={styles.controlIcon}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              next();
            }}
            hitSlop={10}
            style={styles.controlBtn}
          >
            <Text style={styles.controlIcon}>⏭</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.miniPlayerBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.miniPlayerBorder,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  artist: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  controlBtn: {
    padding: 4,
  },
  controlIcon: {
    fontSize: 20,
    color: Colors.controlActive,
  },
});
