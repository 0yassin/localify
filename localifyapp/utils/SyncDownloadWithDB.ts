import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as FileSystem from 'expo-file-system/legacy';

export async function SyncDownloadWithDB(): Promise<boolean> {
  let changed = false;
  try{

  const downloadedTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.downloaded, true));

  for (const track of downloadedTracks) {
    if (!track.filename) {
      await db
        .update(tracks)
        .set({
          downloaded: false,
          filename: null,
        })
        .where(eq(tracks.id, track.id));

      changed = true;
      continue;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(track.filename);

      if (!fileInfo.exists) {
        await db
          .update(tracks)
          .set({
            downloaded: false,
            filename: null,
          })
          .where(eq(tracks.id, track.id));

        changed = true;
      }
    } catch (e) {
      console.error(`Sync error for ${track.id}:`, e);

      await db
        .update(tracks)
        .set({
          downloaded: false,
          filename: null,
        })
        .where(eq(tracks.id, track.id));

      changed = true;
    }
  }
  }
  catch (e){
    console.error(e)
  }

  return changed

}