import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { ArtworkImage } from './ArtworkImage';
import { Colors, Spacing, Typography } from '@/theme';
import { formatDuration } from '@/utils/format';
import type { Track } from '@/db/library';

type Props = {
  track: Track;
  onPress: (track: Track) => void;
  showArtwork?: boolean;
  showTrackNum?: boolean;
  isActive?: boolean;
  rightElement?: React.ReactNode;
};

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  showArtwork = true,
  showTrackNum = false,
  isActive = false,
  rightElement,
}: Props) {
  const handlePress = useCallback(() => onPress(track), [onPress, track]);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      {showTrackNum && (
        <Text style={[styles.trackNum, isActive && styles.trackNumActive]}>
          {track.trackNum ?? '–'}
        </Text>
      )}
      {showArtwork && !showTrackNum && (
        <ArtworkImage uri={track.artworkUri} size={44} style={styles.artwork} />
      )}
      <View style={styles.info}>
        <Text
          style={[styles.title, isActive && styles.titleActive]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {track.artist}
          </Text>
          {track.isLossless && (
            <View style={styles.losslessBadge}>
              <Text style={styles.losslessText}>Lossless</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        {rightElement ?? (
          <Text style={styles.duration}>{formatDuration(track.duration)}</Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  artwork: {
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  titleActive: {
    color: Colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  losslessBadge: {
    backgroundColor: Colors.losslessBg,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  losslessText: {
    fontSize: 9,
    fontWeight: Typography.semibold,
    color: Colors.losslessText,
    letterSpacing: 0.3,
  },
  right: {
    flexShrink: 0,
  },
  duration: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  trackNum: {
    width: '8%',
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  trackNumActive: {
    color: Colors.accent,
  },
});
