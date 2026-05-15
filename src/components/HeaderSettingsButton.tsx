import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { Colors } from '@/theme';

export function HeaderSettingsButton() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => navigation.navigate('ScanSettings')}
      hitSlop={12}
      style={styles.headerBtn}
    >
      <Text style={styles.headerBtnIcon}>⚙</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  headerBtnIcon: {
    fontSize: 22,
    color: Colors.textPrimary,
  },
});
