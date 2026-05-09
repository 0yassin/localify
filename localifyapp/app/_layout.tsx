import "@/global.css"
import React, { Suspense, useEffect } from 'react';
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
import { ActivityIndicator } from "react-native";


import {SQLiteProvider, openDatabaseAsync, openDatabaseSync} from 'expo-sqlite'
import { drizzle } from "drizzle-orm/expo-sqlite"
import {useMigrations} from "drizzle-orm/expo-sqlite/migrator"
import migrations from "@/drizzle/migrations"


export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-SemiBold':Poppins_600SemiBold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

export const DATABASE_NAME = 'Localify'

function RootLayoutNav() {
  

  const expoDb = openDatabaseSync(DATABASE_NAME)
  const db = drizzle(expoDb)
  const {success, error} = useMigrations(db, migrations)

  return (
    <Suspense fallback={<ActivityIndicator size={"large"}/>}>
      <SQLiteProvider 
        databaseName={DATABASE_NAME} 
        useSuspense
        options={{ enableChangeListener: true }}>

    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
    </SQLiteProvider>
    </Suspense>
  );
}

