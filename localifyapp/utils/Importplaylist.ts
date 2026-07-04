import { db } from '@/db/client';
import { playlists, tracks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Alert } from 'react-native';
import z from 'zod';

const urlscheme = z.url().refine(
    (url) => url.includes('open.spotify.com/playlist/'),
    { message: "Must be a valid Spotify playlist link" }
);

interface SpotifyTrackResponse {
    id: string;
    title: string;
    artist: string;
    image: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

function extractPlaylistId(url: string): string | null {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

export async function Importplaylist(spotifyurl: string, setIsSubmitting: (loading: boolean) => void) {
    const validation = urlscheme.safeParse(spotifyurl);
    if (!validation.success) {
        Alert.alert("Invalid URL", "Please enter a correct Spotify playlist share link.");
        return;
    }

    const playlistId = extractPlaylistId(spotifyurl);
    if (!playlistId) {
        Alert.alert("Invalid URL", "Could not extract a playlist ID from that link.");
        return;
    }

    try {
        setIsSubmitting(true);

        const response = await fetch(`${API_URL}/api/playlist/fetch`, {
            method: 'POST',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ url: spotifyurl }),
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const json = await response.json();
        if (json.status !== "success") {
            Alert.alert("Import failed", json.errordetail);
            return;
        }

        const fetched_tracks: SpotifyTrackResponse[] = json.tracks;
        if (fetched_tracks.length === 0) {
            Alert.alert("Empty playlist", "This playlist has no tracks.");
            return;
        }

        await db.transaction(async (tx) => {
            const existingPlaylist = await tx.query.playlists.findFirst({
                where: eq(playlists.id, playlistId),
            });

            if (existingPlaylist) {
                await tx.update(playlists)
                    .set({
                        lastChecked: new Date().toISOString(),
                        name: json.playlist_name,
                        icon: json.icon,
                    })
                    .where(eq(playlists.id, playlistId));
            } else {
                await tx.insert(playlists).values({
                    id: playlistId,
                    name: json.playlist_name,
                    url: spotifyurl,
                    lastChecked: new Date().toISOString(),
                    icon: json.icon,
                });
            }

            const payload = fetched_tracks.map((track) => ({
                id: track.id,
                playlist: playlistId,
                downloaded: false,
                title: track.title,
                artist: track.artist,
                filename: null,
                image: track.image,
            }));

            await tx.insert(tracks)
                .values(payload)
                .onConflictDoNothing({ target: tracks.id });
        });
    } catch (error) {
        console.error(`Playlist import pipeline failed: apiurl ${API_URL}`, error);
        Alert.alert("Import Error", "Something went wrong while connecting to your server or database.");
        throw error;
    } finally {
        setIsSubmitting(false);
    }
}