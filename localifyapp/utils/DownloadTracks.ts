import { db } from '@/db/client';
import { Track, tracks } from '@/db/schema';
import { downloadStore } from '@/utils/DownloadStore';
import { moveToSAF } from '@/utils/MoveToSaf';
import { enqueueSAFWrite } from '@/utils/safque';
import { createDownloadTask, directories, getExistingDownloadTasks } from '@kesha-antonov/react-native-background-downloader';
import { and, eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import { GetDirectLink } from './GetDirectLink';
import { searchYoutube } from './SearchYT';
import { DOWNLOAD_CONCURRENCY, mapWithConcurrency, RESOLVE_CONCURRENCY } from './concurrency';
import { withDbLock } from './dbMutex';

export type ManifestItem = { trackId: string; title: string; directUrl: string; existingFilename?: string | null };
type DownloadResult = { success: boolean; title: string };

export async function resolveTrackLink(track: Track): Promise<ManifestItem | null> {
    try {
        let ytUrl = track.ytlink;
        if (!ytUrl || ytUrl.length <= 1) {
            const vidID = await searchYoutube(`${track.title} - ${track.artist}`.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim());
            ytUrl = `https://www.youtube.com/watch?v=${vidID}`;
            await withDbLock(() => db.update(tracks).set({ ytlink: ytUrl }).where(eq(tracks.id, track.id)));
        }
        const directUrl = await GetDirectLink(ytUrl);
        return { trackId: track.id, title: track.title, directUrl, existingFilename: track.filename };
    } catch (err) {
        console.error(`Skipped track link generation for ${track.title}:`, err);
        return null;
    }
}

async function finalizeDownload(params: {
    trackId: string;
    title: string;
    existingFilename?: string | null;
    activeFolder: string;
    sourceUri: string;
}): Promise<{ success: boolean }> {
    try {
        await enqueueSAFWrite(async () => {
            const finalUri = await moveToSAF(
                params.sourceUri,
                params.activeFolder,
                `${params.title}-[${params.trackId}].mp3`,
                params.existingFilename
            );
            const fileInfo = await FileSystem.getInfoAsync(finalUri);
            if (!fileInfo.exists) {
                throw new Error(`Download failed for track ${params.title}`);
            }
            await withDbLock(() =>
                db.update(tracks).set({ downloaded: true, filename: finalUri }).where(eq(tracks.id, params.trackId))
            );
            const internalCachePath = params.sourceUri.replace('file://', '');
            try {
                await FileSystem.deleteAsync(internalCachePath, { idempotent: true });
            } catch {}
        });
        downloadStore.remove(params.trackId);
        return { success: true };
    } catch (e) {
        console.error(`Failed to finalize download for ${params.title}:`, e);
        downloadStore.remove(params.trackId);
        return { success: false };
    }
}

export function downloadAndStore(item: ManifestItem, activeFolder: string): Promise<DownloadResult> {
    return new Promise((resolve) => {
        (async () => {
            const alreadyActive = downloadStore.getSnapshot()[item.trackId];
            if (alreadyActive) {
                console.warn(`Download already in progress for ${item.trackId}, skipping duplicate start`);
                resolve({ success: false, title: item.title });
                return;
            }

            try {
                const internalCachePath = `${directories.documents}/${item.trackId}.mp3`;
                const localSourceUri = `file://${internalCachePath}`;
                let settled = false;

                const task = createDownloadTask({
                    id: item.trackId,
                    url: item.directUrl,
                    destination: internalCachePath,
                });

                downloadStore.register(item.trackId, task);

                task.begin(({ expectedBytes }: any) => {
                    downloadStore.updateProgress(item.trackId, 0, expectedBytes);
                });

                task.progress(({ bytesDownloaded, bytesTotal }: any) => {
                    downloadStore.updateProgress(item.trackId, bytesDownloaded, bytesTotal);
                });

                task.done(async ({ location }: any) => {
                    if (settled) return;
                    settled = true;
                    const actualSourceUri = location
                        ? (location.startsWith('file://') ? location : `file://${location}`)
                        : localSourceUri;
                    const result = await finalizeDownload({
                        trackId: item.trackId,
                        title: item.title,
                        existingFilename: item.existingFilename,
                        activeFolder,
                        sourceUri: actualSourceUri,
                    });
                    resolve({ success: result.success, title: item.title });
                });

                task.error((e: unknown) => {
                    if (settled) return;
                    settled = true;
                    console.error(`Download task error for ${item.title}:`, e);
                    downloadStore.remove(item.trackId);
                    resolve({ success: false, title: item.title });
                });

                task.start();
            } catch (e) {
                console.error(`Failed to start download for ${item.title}:`, e);
                downloadStore.remove(item.trackId);
                resolve({ success: false, title: item.title });
            }
        })();
    });
}

export async function retryTrackDownload(track: Track, activeFolder: string): Promise<DownloadResult> {
    const item = await resolveTrackLink(track);
    if (!item) {
        return { success: false, title: track.title };
    }
    return downloadAndStore(item, activeFolder);
}

export async function reattachExistingDownloads(activeFolder: string): Promise<void> {
    let existingTasks;
    try {
        existingTasks = await getExistingDownloadTasks();
    } catch (e) {
        console.error('Failed to check for existing downloads:', e);
        return;
    }

    for (const task of existingTasks) {
        const trackId = task.id;

        if (downloadStore.getSnapshot()[trackId]) continue; 

        const trackRows = await withDbLock(() =>
            db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1)
        );
        const track = trackRows[0];

        if (!track) {
            try { await task.stop(); } catch {}
            continue;
        }

        if (track.downloaded) {
            continue;
        }

        const internalCachePath = `${directories.documents}/${trackId}.mp3`;
        const localSourceUri = `file://${internalCachePath}`;
        let settled = false;

        downloadStore.register(trackId, task);

        task.begin(({ expectedBytes }: any) => {
            downloadStore.updateProgress(trackId, 0, expectedBytes);
        });

        task.progress(({ bytesDownloaded, bytesTotal }: any) => {
            downloadStore.updateProgress(trackId, bytesDownloaded, bytesTotal);
        });

        task.done(async ({ location }: any) => {
            if (settled) return;
            settled = true;
            const actualSourceUri = location
                ? (location.startsWith('file://') ? location : `file://${location}`)
                : localSourceUri;
            await finalizeDownload({
                trackId,
                title: track.title,
                existingFilename: track.filename,
                activeFolder,
                sourceUri: actualSourceUri,
            });
        });

        task.error((e: unknown) => {
            if (settled) return;
            settled = true;
            console.error(`Reattached download errored for ${track.title}:`, e);
            downloadStore.remove(trackId);
        });

        try {
            const info = await FileSystem.getInfoAsync(localSourceUri);
            if (info.exists && !settled) {
                settled = true;
                await finalizeDownload({
                    trackId,
                    title: track.title,
                    existingFilename: track.filename,
                    activeFolder,
                    sourceUri: localSourceUri,
                });
            }
        } catch (e) {
            console.error(`Error checking reattached task file for ${track.title}:`, e);
        }
    }
}

export async function downloadPendingTracksForPlaylist(playlistId: string, folder: string) {
    const pendingTracks = await withDbLock(() =>
        db.select().from(tracks).where(and(eq(tracks.playlist, playlistId), eq(tracks.downloaded, false)))
    );

    if (pendingTracks.length === 0) {
        return { resolveFailures: 0, downloadFailures: 0, downloadSuccesses: 0 };
    }

    const manifestResults = await mapWithConcurrency(pendingTracks, RESOLVE_CONCURRENCY, (track) => resolveTrackLink(track));
    const urlManifest = manifestResults.filter((item): item is ManifestItem => item !== null);
    const resolveFailures = pendingTracks.length - urlManifest.length;

    const downloadResults = await mapWithConcurrency(urlManifest, DOWNLOAD_CONCURRENCY, (item) => downloadAndStore(item, folder));
    const downloadSuccesses = downloadResults.filter(r => r.success).length;
    const downloadFailures = downloadResults.filter(r => !r.success).length;

    return { resolveFailures, downloadFailures, downloadSuccesses };
}