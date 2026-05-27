import * as TaskManager from 'expo-task-manager';
import { File, Directory } from 'expo-file-system';
import { db } from '@/db/client';
import { tracks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import * as Location from 'expo-location';


export const DOWNLOAD_TASK_NAME = 'LOCALIFY_AUDIO_DOWNLOADER';

TaskManager.defineTask(DOWNLOAD_TASK_NAME, async ({data, error}: any) => {
    if (error){
        console.error("task error", error)
        return
    }

    const globalStateObject = (global as any).__localifyDownloadParams;
    if (!globalStateObject) {
        console.log("Parameter manifest state is empty. Shutting down.");
        await Location.stopLocationUpdatesAsync(DOWNLOAD_TASK_NAME);
        return;
    }


    const { folderUri, playlistId } = globalStateObject;

    try {
        const syncQueue = await db.select()
            .from(tracks)
            .where(eq(tracks.downloaded, false));

        if (syncQueue.length === 0) {
            console.log("Nothing to download")
            return;
        }

        const totaltracks = syncQueue.length
        const targetdir = new Directory(folderUri)

        for (let i = 0; i < totaltracks; i++) {
            const track = syncQueue[i];
            console.log(`processing track ${i + 1}/${totaltracks}: ${track.title}`);

            try{
                const searchQuery = encodeURIComponent(`${track.title} - ${track.artist} audio`)
                const searchResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${searchQuery}&filter=videos`)
                const searchJson = await searchResponse.json();

                if (!searchJson.items || searchJson.items.length === 0) continue;
                const targetVideoId = searchJson.items[0].id;
                const streamInfoResponse = await fetch(`https://pipedapi.kavin.rocks/streams/${targetVideoId}`);
                const streamJson = await streamInfoResponse.json();

                const directAudioUrl = streamJson.audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0].url;


                const targetFile = new File(targetdir, `${track.id}.mp3`);
                await File.downloadFileAsync(directAudioUrl, targetFile);

                await db.update(tracks)
                .set({ downloaded: true, filename: `${track.id}.mp3` })
                .where(eq(tracks.id, track.id));

                console.log(`finished downloading: ${track.title}`)
            }
            catch (err) {
                console.error(`downloading track ${track.title} failed`, err)
            }
        }

        console.log("downloading tracks complete")

        
    }
    
    catch (globalError) {
        console.error("Critical breakdown inside download engine execution loop:", globalError);
    }

    finally{
        await Location.stopLocationUpdatesAsync(DOWNLOAD_TASK_NAME);
    }

            
});