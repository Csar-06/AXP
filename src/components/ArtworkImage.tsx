import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius } from '@/theme';

type Props = {
  uri: string | null | undefined;
  size: number;
  radius?: number;
  style?: ViewStyle;
};

const PLACEHOLDER = require('../../assets/artwork-placeholder.png');

export function ArtworkImage({ uri, size, radius = Radius.md, style }: Props) {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      <Image
        source={uri ? { uri } : PLACEHOLDER}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
});
