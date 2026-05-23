import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from './schema'

export const DATABASE_NAME = process.env.EXPO_PUBLIC_DATABASE_NAME || 'default'

export const expoDb = openDatabaseSync(DATABASE_NAME, {enableChangeListener:true})

export const db = drizzle(expoDb, {schema})