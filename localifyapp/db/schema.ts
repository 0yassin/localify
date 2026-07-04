import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const playlists = sqliteTable('playlists', {
    id: text('id').primaryKey().notNull().unique(),
    name: text('name').notNull(),
    url: text('url').notNull().unique(),
    lastChecked: text('last_checked'),
    icon: text('icon'),
})

export const tracks = sqliteTable('tracks', {
    id: text('id').primaryKey().notNull().unique(),
    playlist: text('playlist').references(() => playlists.id, { onDelete: 'cascade' }),
    downloaded: integer('downloaded', {mode:'boolean'}).default(false),
    title: text('title').notNull(),
    artist: text('artist'),
    filename: text('filename'),
    image: text('image'),
    ytlink: text('ytlink'),
})

export const user = sqliteTable('user', {
    id: integer('id').primaryKey().default(1),
    theme: text('theme').default('light'),
    folder: text('folder')
})

export type Playlist = typeof playlists.$inferSelect;
export type Track = typeof tracks.$inferSelect;