import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type LayoutChangeEvent,
} from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Gap re-added after the text before it loops back. */
  trailing?: number;
};

/**
 * Single-line text that gently scrolls back and forth when it is wider than the
 * space available. Falls back to a static (ellipsized) line when it fits.
 */
export function MarqueeText({ text, style, trailing = 24 }: Props) {
  const [containerW, setContainerW] = useState(0);
  const [textW, setTextW] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const overflow = containerW > 0 && textW > containerW + 1;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!overflow) return;

    const distance = textW - containerW + trailing;
    const duration = Math.max(2200, distance * 45);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1100),
        Animated.timing(translateX, {
          toValue: 0,
          duration: Math.max(1400, duration * 0.6),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [overflow, textW, containerW, trailing, translateX]);

  const onContainerLayout = (e: LayoutChangeEvent) =>
    setContainerW(e.nativeEvent.layout.width);
  const onTextLayout = (e: LayoutChangeEvent) =>
    setTextW(e.nativeEvent.layout.width);

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* Off-screen measurer: unconstrained width so we read the natural size. */}
      <View style={styles.measure} pointerEvents="none">
        <Text numberOfLines={1} style={style} onLayout={onTextLayout}>
          {text}
        </Text>
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[
          style,
          { transform: [{ translateX }] },
          overflow ? { width: textW } : null,
        ]}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    width: 9999,
  },
});
