import Track from "@/components/Track";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { type InferSelectModel, eq } from "drizzle-orm";
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";


type BaseTrackRow = InferSelectModel<typeof tracks>;

async function SyncDownloadWithDB(): Promise<boolean> {
  const downloadedTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.downloaded, true));

  let changed = false;

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

  return changed;
}

export default function Playlistscreen() {
    const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
    const router = useRouter(); 

    const [tracklist, setTracklist] = useState<BaseTrackRow[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchtracks = async () => {
        if (!id) return;
        try {
            SyncDownloadWithDB()
            setLoading(true);
            const results = await db
                .select()
                .from(tracks)
                .where(eq(tracks.playlist, Number(id)));

            setTracklist(results);
        } catch (error) {
            console.error("Failed to load tracks for playlist:", error);        
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchtracks();
    }, [id]);

    return (
        <View className="flex-1 bg-white px-6 pt-14">
            
            <View className="flex-row items-center mb-3 gap-2">
                <Pressable 
                    onPress={() => router.back()} 
                    className="p-2 -ml-2 active:opacity-50"
                    hitSlop={20} 
                >
                    <Ionicons name="arrow-back" size={26} color="#161616" />
                </Pressable>
                <Text className='text-[31px] font-poppinsBold flex-1'>Localify</Text>
            </View>
            <View className="flex flex-row justify-between w-full">

            <Text className='text-[25px] font-poppinsBold mb-4' numberOfLines={1}>
                {title || "Playlist Tracks"}
            </Text>
            <View>
                
            </View>
                <Pressable onPress={()=>{fetchtracks()}} className='bg-green-500 aspect-square h-10'><Text className='w-full h-full text-center'>Rel</Text></Pressable>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size={'large'} color={'#161616'} />
                </View>
            ) : (
                <FlatList 
                    className="flex-1"  
                    data={tracklist} 
                    keyExtractor={(item) => item.id.toString()} 
                    ListEmptyComponent={
                        <Text className="text-zinc-400 font-poppinsMedium text-center mt-12">
                            No tracks imported in this playlist yet.
                        </Text>
                    } 
                    contentContainerStyle={{ paddingBottom: 60, gap: 10 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Track 
                            Title={item.title} 
                            Artist={item.artist ?? 'Unknown Artist'}  
                            image={item.image ?? ''}
                            Downloaded={!!item.downloaded}
                        />
                    )}
                />
            )}
        </View>
    );
}