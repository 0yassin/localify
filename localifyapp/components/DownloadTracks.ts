import { db } from '@/db/client';
import { Track, tracks } from '@/db/schema';
import { moveToSAF } from '@/utils/MoveToSaf';
import { enqueueSAFWrite } from '@/utils/safque';
import { createDownloadTask, directories } from '@kesha-antonov/react-native-background-downloader';
import { eq } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import { GetDirectLink } from './GetDirectLink';
import { searchYoutube } from './SearchYT';

export type ManifestItem = { trackId: string; title: string; directUrl: string };
type DownloadResult = { success: boolean; title: string };

export async function resolveTrackLink(track: Track): Promise<ManifestItem | null> {
  try {
    let ytUrl = track.ytlink;

    if (!ytUrl || ytUrl.length <= 1) {
      const vidID = await searchYoutube(`${track.title} - ${track.artist}`);
      ytUrl = `https://www.youtube.com/watch?v=${vidID}`;
      await db.update(tracks).set({ ytlink: ytUrl }).where(eq(tracks.id, track.id));
    }

    const directUrl = await GetDirectLink(ytUrl);
    return { trackId: track.id, title: track.title, directUrl };
  } catch (err) {
    console.error(`Skipped track link generation for ${track.title}:`, err);
    return null;
  }
}

export async function downloadAndStore(item: ManifestItem, activeFolder: string): Promise<DownloadResult> {
  return new Promise((resolve) => {
    const internalCachePath = `${directories.documents}/${item.trackId}.mp3`;
    const localSourceUri = `file://${internalCachePath}`;

    const task = createDownloadTask({
      id: item.trackId,
      url: item.directUrl,
      destination: internalCachePath,
    });

    task.begin(() => {});

    task.done(async () => {
      try {
        await enqueueSAFWrite(async () => {
          const finalUri = await moveToSAF(localSourceUri, activeFolder, `${item.title}-[${item.trackId}].mp3`);
          const fileInfo = await FileSystem.getInfoAsync(finalUri);

          if (!fileInfo.exists) {
            throw new Error(`Download failed for track ${item.title}`);
          }

          await db.update(tracks).set({ downloaded: true, filename: finalUri }).where(eq(tracks.id, item.trackId));

          try {
            await FileSystem.deleteAsync(internalCachePath, { idempotent: true });
          } catch {
          }
        });
        resolve({ success: true, title: item.title });
      } catch (e) {
        console.error(`Failed to finalize download for ${item.title}:`, e);
        resolve({ success: false, title: item.title });
      }
    });

    task.error((e: unknown) => {
      console.error(`Download task error for ${item.title}:`, e);
      resolve({ success: false, title: item.title });
    });

    task.start();
  });
}