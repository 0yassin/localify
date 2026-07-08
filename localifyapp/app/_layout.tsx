
import "@/global.css";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import migrations from "@/drizzle/migrations";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { SQLiteProvider } from 'expo-sqlite';

import { DATABASE_NAME, db } from "@/db/client";
import { RegisterBackgroundSync } from "@/tasks/backgroundsync";
import { reattachExistingDownloads } from "@/utils/DownloadTracks";
import { StorageUtil } from "@/utils/Storage";

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    useEffect(() => {
        RegisterBackgroundSync(60); 
    }, []);
    useEffect(() => {
        async function init() {
            const folder = await StorageUtil.GetFolder();
            if (folder) {
                await reattachExistingDownloads(folder);
            }
        }
        init();
    }, []);
    
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-SemiBold': Poppins_600SemiBold,
    ...FontAwesome.font,
  });

  const { success: migrationsLoaded, error: migrationError } = useMigrations(db, migrations);

  useEffect(() => {
    if (fontError) throw fontError;
    if (migrationError) console.error("Migration error: ", migrationError);
  }, [fontError, migrationError]);


  useEffect(() => {
    if (fontsLoaded && migrationsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, migrationsLoaded]);

  if (!fontsLoaded || !migrationsLoaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <SQLiteProvider 
      databaseName={DATABASE_NAME} 
      options={{ enableChangeListener: true }}
    >
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </SQLiteProvider>
  );
}