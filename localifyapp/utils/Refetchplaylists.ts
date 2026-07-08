import { db } from "@/db/client";
import { playlists, tracks } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import * as FileSystem from 'expo-file-system/legacy';
import { withDbLock } from "./dbMutex";
import { downloadStore } from "./DownloadStore";
import { downloadPendingTracksForPlaylist } from "./DownloadTracks";
import { SpotifyTrackResponse } from "./Importplaylist";
import { StorageUtil } from "./Storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export async function Refetchplaylists() {
    let anyChanged = false
    let totalDownloadSuccesses = 0;
    let totalDownloadFailures = 0;
    let totalResolveFailures = 0;
    const folder = await StorageUtil.GetFolder();
    const curr_playlists = await withDbLock(() =>
        db.select({ id: playlists.id, name: playlists.name }).from(playlists).where(eq(playlists.synced, true))
    );

    for (const playlist of curr_playlists) {
        try {
            const spotifyurl = 'https://open.spotify.com/playlist/' + playlist.id;

            const response = await fetch(`${API_URL}/api/playlist/fetch`, {
                method: 'POST',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify({ url: spotifyurl }),
            });

            if (!response.ok) {
                console.error(`Refetch failed for playlist ${playlist.id}: status ${response.status}`);
                continue; 
            }

            const json = await response.json();
            if (json.status !== "success") {
                console.log("Import failed [refetch]", json.errordetail);
                continue;
            }

            const fetched_tracks: SpotifyTrackResponse[] = json.tracks;
            const fetchedTrackIds = new Set(fetched_tracks.map(t => t.id));

            const curr_tracks = await withDbLock(() =>
                db.select({ id: tracks.id, filename: tracks.filename })
                    .from(tracks)
                    .where(eq(tracks.playlist, playlist.id))
            );
            const existingTrackIds = new Set(curr_tracks.map(t => t.id));

            const tracksChanged =
                existingTrackIds.size !== fetchedTrackIds.size ||
                [...existingTrackIds].some(id => !fetchedTrackIds.has(id));

            const nameChanged = playlist.name !== json.playlist_name;

            if (!tracksChanged && !nameChanged) continue;
            anyChanged = true;

            const removedTracks = curr_tracks.filter(t => !fetchedTrackIds.has(t.id));
            for (const t of removedTracks) {
                await downloadStore.cancel(t.id);
                if (t.filename) {
                    try {
                        await FileSystem.deleteAsync(t.filename);
                    } catch (e) {
                        console.log("File cleanup failed for removed track:", e);
                    }
                }
            }
            await withDbLock(() =>
                db.transaction(async (tx) => {
                    if (nameChanged) {
                        await tx.update(playlists)
                            .set({ name: json.playlist_name, lastChecked: new Date().toISOString() })
                            .where(eq(playlists.id, playlist.id));
                    }

                    if (tracksChanged) {
                        const payload = fetched_tracks.map((track) => ({
                            id: track.id,
                            playlist: playlist.id,
                            downloaded: false,
                            title: track.title,
                            artist: track.artist,
                            filename: null,
                            image: track.image,
                        }));

                        if (payload.length > 0) {
                            await tx.insert(tracks)
                                .values(payload)
                                .onConflictDoNothing({ target: tracks.id });
                        }

                        if (removedTracks.length > 0) {
                            await tx.delete(tracks).where(
                                inArray(tracks.id, removedTracks.map(t => t.id))
                            );
                        }
                    }
                })
            );
            if (tracksChanged && folder) {
                const result = await downloadPendingTracksForPlaylist(playlist.id, folder);
                totalDownloadSuccesses += result.downloadSuccesses;
                totalDownloadFailures += result.downloadFailures;
                totalResolveFailures += result.resolveFailures;
            }
        } catch (err) {
            console.error(`Refetch pipeline failed for playlist ${playlist.id}:`, err);
        }
    }

   return {
        changed: anyChanged,
        downloadSuccesses: totalDownloadSuccesses,
        downloadFailures: totalDownloadFailures,
        resolveFailures: totalResolveFailures,
    };
}