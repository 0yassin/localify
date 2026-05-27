// import { File, Directory } from 'expo-file-system';
// import {db} from "../db/client"
// import { tracks } from "@/db/schema"
// import { eq } from "drizzle-orm"

// export async function ProcessDownload(track:any, folder:string) {

//     try{
//         const searchQuery = encodeURIComponent(`${track.title} - ${track.artist} audio`)
//         console.log(`resolving stream`)

//         const searchResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${searchQuery}&filter=videos`)
//         const searchJson = await searchResponse.json();

//         if(!searchJson.items || searchJson.items.lenght === 0){
//             throw new Error("no matching streams found")
//         }

//         const targetVideoId = searchJson.items[0].id;
//         const streamInfoResponse = await fetch(`https://pipedapi.kavin.rocks/streams/${targetVideoId}`);
//         const streamJson = await streamInfoResponse.json();
//         const audURL = streamJson.audioStreams.sort((a:any, b:any) => b.bitrate - a.bitrate)[0].url

//         const targetDirectory = new Directory(folder);
//         const targetFile = new File(targetDirectory, `${track.id}.mp3`);

//         const output = await File.downloadFileAsync(audURL, targetFile, {

//         });

//         console.log("file downloaded")

//         await db.update(tracks)
//         .set({ downloaded: true, filename: `${track.id}.mp3` })
//         .where(eq(tracks.id, track.id));


//     }
//     catch (error) {
//         console.error("download failed I think")
//     }
// }