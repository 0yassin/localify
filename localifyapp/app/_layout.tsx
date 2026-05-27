import '@/utils/DownloadWorker';

import "@/global.css";
import React, { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold,
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { ActivityIndicator, View } from "react-native";

import { SQLiteProvider } from 'expo-sqlite';
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";

import { db, DATABASE_NAME } from "@/db/client"; 

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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