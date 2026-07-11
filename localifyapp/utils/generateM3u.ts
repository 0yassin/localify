import * as FileSystem from 'expo-file-system/legacy'
import { db } from "@/db/client";
import { withDbLock } from "./dbMutex";
import { playlists, tracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function generateM3u(playlistId: string, folderUri: string): Promise<string | null> {
    const playlistRow = await withDbLock(() =>
        db.select({ name: playlists.name, m3uUri: playlists.m3uUri }).from(playlists).where(eq(playlists.id, playlistId)).limit(1)
    );
    if (!playlistRow[0]) return null;

    const { name: playlistName, m3uUri: existingM3uUri } = playlistRow[0];

    const trackRows = await withDbLock(() =>
        db.select({ id: tracks.id, title: tracks.title, artist: tracks.artist })
            .from(tracks)
            .where(and(eq(tracks.playlist, playlistId), eq(tracks.downloaded, true)))
    );
    if (trackRows.length === 0) return null;

    const lines = ['#EXTM3U'];
    for (const track of trackRows) {
        lines.push(`#EXTINF:-1,${track.artist ?? 'Unknown Artist'} - ${track.title}`);
        lines.push(`${track.title}-[${track.id}].mp3`);
    }

    const SAF = FileSystem.StorageAccessFramework;
    const safeName = playlistName.replace(/[^\w\s-]/g, '').trim() || 'playlist';

    if (existingM3uUri) {
        try { await SAF.deleteAsync(existingM3uUri); } catch {}
    }

    try {
        const fileUri = await SAF.createFileAsync(folderUri, `${safeName}.m3u8`, 'application/vnd.apple.mpegurl');
        await SAF.writeAsStringAsync(fileUri, lines.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
        await withDbLock(() => db.update(playlists).set({ m3uUri: fileUri }).where(eq(playlists.id, playlistId)));
        return fileUri;
    } catch (e) {
        console.error(`generateM3u: failed for playlist ${playlistId}:`, e);
        return null;
    }
}