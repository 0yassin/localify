import z from 'zod'
import { Alert } from 'react-native';
import { db } from '@/db/client';
import { playlists, tracks } from '@/db/schema';
import { eq } from 'drizzle-orm';

const urlscheme = z.url().refine(
  (url) => url.includes('open.spotify.com/playlist/'),
  { message: "Must be a valid Spotify playlist link" }
);


interface SpotifyTrackResponse {
    id: string, // text('id').primaryKey().notNull().unique()
    playlist: number, // playlist ID in the playlist table I think
    downloaded: false,
    title: string,
    artist: string,
    filename: null,
    image: string
  }
  
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'localhost:8000'


export async function Importplaylist(spotifyurl:string, setIsSubmitting: (loading: boolean) => void) {

  const validation = urlscheme.safeParse(spotifyurl);
  if (!validation.success){
    Alert.alert("Invalid URL", "Please enter a correct Spotify playlist share link.");
    return;
  }

  try {
    setIsSubmitting(true)

  


    

    // expects : 
    //{
    //   "status": "success",
    //   "playlist_name": "Peak Songs",
    //   "icon": "music",
    //   "tracks": [
    //     {
    //       "id": "4ptzPh9pB653XpAcoY4A7C",
    //       "title": "Song Title One",
    //       "artist": "Artist Name"
    //     },
    //     {
    //       "id": "2TpxZ7JUBn3uw46gR7qd6V",
    //       "title": "Song Title Two",
    //       "artist": "Another Artist"
    //     }
    //   ]
    // }

    const response = await fetch("http://192.168.11.105:8000/api/playlist/fetch", {
      method: 'POST',
      headers: {'Content-type': 'application/json'},
      body: JSON.stringify({ 
        url: spotifyurl 
      })
    })

    if (!response.ok){
      throw new Error(`Server responded with status : ${response.status}`)
    }

    const json = await response.json();

    if (json.status !== "success"){
      Alert.alert("import failed", json.errordetail)
      return
    } 



    const fetched_tracks:SpotifyTrackResponse[] = json.tracks;

    if (fetched_tracks.length === 0){Alert.alert("The track is empty"); return;}


    const playlistName = json.playlist_name


    let targetplaylistid:number;

    const existingPlaylist = await db.query.playlists.findFirst({
      where: eq(playlists.url, spotifyurl),
    });


    if (existingPlaylist){
      targetplaylistid = existingPlaylist.id

      await db.update(playlists)
        .set({lastChecked: new Date().toISOString()})
        .where(eq(playlists.id, targetplaylistid));
    } else {

      const [newplaylist] = await db.insert(playlists).values({
        name: playlistName,
        url: spotifyurl,
        lastChecked: new Date().toISOString(),
        icon: json.icon
      }).returning({insertedId: playlists.id})

      targetplaylistid = newplaylist.insertedId;
    }

    const payload = fetched_tracks.map((track) => ({
        id: track.id, // text('id').primaryKey().notNull().unique()
        playlist: targetplaylistid,
        downloaded: false,
        title: track.title,
        artist: track.artist,
        filename: null,
        image: track.image,

    }));

    await db.insert(tracks)
      .values(payload)
      .onConflictDoNothing({target: tracks.id})

    Alert.alert("Success!", `Synchronized playlist and added ${fetched_tracks.length} tracks local to your device.`);


  
  } catch (error) {
    console.error("Playlist import pipeline failed:", error);
    Alert.alert("Import Error", "Something went wrong while connecting to your server or database.");
    throw error
  } finally {
    setIsSubmitting(false);
  }


}