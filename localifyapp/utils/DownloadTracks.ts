import { db } from '@/db/client';
import { Track, tracks } from '@/db/schema';
import { downloadStore } from '@/utils/DownloadStore';
import { moveToSAF } from '@/utils/MoveToSaf';
import { enqueueSAFWrite } from '@/utils/safque';
import { createDownloadTask, directories } from '@kesha-antonov/react-native-background-downloader';
import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import { GetDirectLink } from './GetDirectLink';
import { searchYoutube } from './SearchYT';
import { withDbLock } from './dbMutex';

export type ManifestItem = { trackId: string; title: string; directUrl: string; existingFilename?: string | null };
type DownloadResult = { success: boolean; title: string };

export async function resolveTrackLink(track: Track): Promise<ManifestItem | null> {
  try {
    let ytUrl = track.ytlink;

    if (!ytUrl || ytUrl.length <= 1) {
      const vidID = await searchYoutube(`${track.title} - ${track.artist}`.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim());
      ytUrl = `https://www.youtube.com/watch?v=${vidID}`;
      await withDbLock(()=>db.update(tracks).set({ ytlink: ytUrl }).where(eq(tracks.id, track.id)));
    }

    const directUrl = await GetDirectLink(ytUrl);
    return { trackId: track.id, title: track.title, directUrl, existingFilename: track.filename };  } catch (err) {
    console.error(`Skipped track link generation for ${track.title}:`, err);
    return null;
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
                let settled = false; 

                const internalCachePath = `${directories.documents}/${item.trackId}.mp3`;
                const localSourceUri = `file://${internalCachePath}`;
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
                    console.log(`[progress] ${item.trackId}: ${bytesDownloaded}/${bytesTotal} at ${Date.now()}`);
                    downloadStore.updateProgress(item.trackId, bytesDownloaded, bytesTotal);
                });
                task.done(async ({location}) => {
                    if (settled) return; 
                    settled = true;

                    const actualSourceUri = location ? (location.startsWith('file://') ? location : 'file://'+location) : localSourceUri;

                    console.log(`acc source URI: ${actualSourceUri} | location: ${location}`)
                    try {
                        await enqueueSAFWrite(async () => {
                            const finalUri = await moveToSAF(actualSourceUri, activeFolder, `${item.title}-[${item.trackId}].mp3`, item.existingFilename);
                            const fileInfo = await FileSystem.getInfoAsync(finalUri);
                            if (!fileInfo.exists) {
                                throw new Error(`Download failed for track ${item.title}`);
                            }
                            await withDbLock(() =>
                                db.update(tracks).set({ downloaded: true, filename: finalUri }).where(eq(tracks.id, item.trackId))
                            );
                            try {
                                await FileSystem.deleteAsync(internalCachePath, { idempotent: true });
                            } catch {}
                        });
                        downloadStore.remove(item.trackId);
                        resolve({ success: true, title: item.title });
                    } catch (e) {
                        console.error(`Failed to finalize download for ${item.title}:`, e);
                        downloadStore.remove(item.trackId);
                        resolve({ success: false, title: item.title });
                    }
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