import React, { useEffect } from 'react';
import { StyleSheet, Text,Image, Pressable, ImageSourcePropType} from 'react-native';
import {
  NavigationContainer,
  useNavigation,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PistasScreen } from '@/screens/PistasScreen';
import { GenerosScreen } from '@/screens/GenerosScreen';
import { AlbumsScreen } from '@/screens/AlbumsScreen';
import { ArtistasScreen } from '@/screens/ArtistasScreen';
import { ListasScreen } from '@/screens/ListasScreen';
import { AlbumDetailScreen } from '@/screens/AlbumDetailScreen';
import { ArtistaDetailScreen } from '@/screens/ArtistaDetailScreen';
import { GeneroDetailScreen } from '@/screens/GeneroDetailScreen';
import { ListaDetailScreen } from '@/screens/ListaDetailScreen';
import { FullPlayerScreen } from '@/screens/FullPlayerScreen';
import { QueueScreen } from '@/screens/QueueScreen';
import { ScanSettingsScreen } from '@/screens/ScanSettingsScreen';
import { MiniPlayer } from '@/components/MiniPlayer';
import { usePlayerStore } from '@/store/playerStore';
import { Colors, Typography } from '@/theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, ImageSourcePropType> = {
  Pistas:   require('../../assets/tabBarIcons/inactive-track-icon.png'),
  Generos:  require('../../assets/tabBarIcons/inactive-genre-icon.png'),
  Albums:   require('../../assets/tabBarIcons/inactive-album-icon.png'),
  Artistas: require('../../assets/tabBarIcons/inactive-artist-icon.png'),
  Listas:   require('../../assets/tabBarIcons/inactive-playlist-icon.png'),
};

function TabIcon({
  name,
  focused,
}: {
  name: keyof TabParamList;
  focused: boolean;
  
}) {
  return (
    <Image
      source={TAB_ICONS[name]}
      style={[
        styles.tabBarIcon,
        focused && { tintColor: Colors.accent },
      ]}
    />

  );
}

function HeaderSettingsButton() {
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

function CustomTabBar(props: BottomTabBarProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const setPlayerVisible = usePlayerStore((s) => s.setPlayerVisible);

  return (
    <>
      {currentTrack && (
        <MiniPlayer onPress={() => setPlayerVisible(true)} />
      )}
      <BottomTabBar {...props} />
    </>
  );
}

function TabScreens() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isPlayerVisible = usePlayerStore((s) => s.isPlayerVisible);

  useEffect(() => {
    if (isPlayerVisible) {
      navigation.navigate('FullPlayer');
    }
  }, [isPlayerVisible, navigation]);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.bg },
        headerTitleStyle: {
          color: Colors.textPrimary,
          fontWeight: Typography.bold,
          fontSize: 17,
        },
        headerShadowVisible: false,
        headerRight: () => <HeaderSettingsButton />,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBg,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: Typography.medium,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name as keyof TabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen
        name="Pistas"
        component={PistasScreen}
        options={{ title: 'Pistas' }}
      />
      <Tab.Screen
        name="Generos"
        component={GenerosScreen}
        options={{ title: 'Géneros' }}
      />
      <Tab.Screen
        name="Albums"
        component={AlbumsScreen}
        options={{ title: 'Álbumes' }}
      />
      <Tab.Screen
        name="Artistas"
        component={ArtistasScreen}
        options={{ title: 'Artistas' }}
      />
      <Tab.Screen
        name="Listas"
        component={ListasScreen}
        options={{ title: 'Listas' }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: Colors.bg },
            headerTitleStyle: {
              color: Colors.textPrimary,
              fontWeight: Typography.bold,
            },
            headerTintColor: Colors.accent,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: Colors.bg },
          }}
        >
          <Stack.Screen
            name="Tabs"
            component={TabScreens}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AlbumDetail"
            component={AlbumDetailScreen}
            options={({ route }) => ({ title: route.params.albumTitle })}
          />
          <Stack.Screen
            name="ArtistaDetail"
            component={ArtistaDetailScreen}
            options={({ route }) => ({ title: route.params.artistName })}
          />
          <Stack.Screen
            name="GeneroDetail"
            component={GeneroDetailScreen}
            options={({ route }) => ({ title: route.params.genreName })}
          />
          <Stack.Screen
            name="ListaDetail"
            component={ListaDetailScreen}
            options={({ route }) => ({ title: route.params.playlistName })}
          />
          <Stack.Screen
            name="FullPlayer"
            component={FullPlayerScreen}
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="QueueView"
            component={QueueScreen}
            options={{ title: 'Cola de reproducción' }}
          />
          <Stack.Screen
            name="ScanSettings"
            component={ScanSettingsScreen}
            options={{ title: 'Ajustes' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
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
  tabBarIcon:{
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
});
