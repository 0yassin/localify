import Track from "@/components/Track";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { useDownloads } from "@/hooks/useDownloads";
import { withDbLock } from "@/utils/dbMutex";
import { downloadStore } from "@/utils/DownloadStore";
import { retryTrackDownload } from "@/utils/DownloadTracks";
import { StorageUtil } from "@/utils/Storage";
import { SyncDownloadWithDB } from "@/utils/SyncDownloadWithDB";
import { Ionicons } from "@expo/vector-icons";
import { type InferSelectModel, eq } from "drizzle-orm";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";


type BaseTrackRow = InferSelectModel<typeof tracks>;


export default function Playlistscreen() {
    const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
    const router = useRouter(); 
    const [tracklist, setTracklist] = useState<BaseTrackRow[]>([]);
    const [loading, setLoading] = useState(false);
    const downloads = useDownloads();
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
    const prevDownloadingRef = useRef<Set<string>>(new Set());
    
    

    const fetchtracks = async () => {
        if (!id) return;
        try {
            SyncDownloadWithDB()
            setLoading(true);
            const results = await withDbLock(()=>db
                .select()
                .from(tracks)
                .where(eq(tracks.playlist, id)));

            setTracklist(results);
            SyncDownloadWithDB()
        } catch (error) {
            console.error("Failed to load tracks for playlist:", error);        
        } finally {
            setLoading(false);
        }
    };

        const handlestartdownload = async (track:BaseTrackRow) => {
            const folder = await StorageUtil.GetFolder()
            if (!folder) {
                Alert.alert('No folder set', 'Please set a download folder from the home screen first.');
                return;
            }
            setDownloadingIds(prev => new Set(prev).add(track.id.toString()));
    
            try {
                const result = await retryTrackDownload(track, folder);
                if (!result.success) {
                    Alert.alert('Download failed', `Couldn't download "${track.title}". Try again?`);
                }
                await fetchtracks();
    
            } finally {
                setDownloadingIds(prev => {
                const next = new Set(prev);
                next.delete(track.id.toString());
                return next;
            });}
        }

    useEffect(() => {
        fetchtracks();
    }, [id]);

    useFocusEffect(useCallback(()=>{
        fetchtracks()
    }, []))

    useEffect(() => {
        const currentIds = new Set(Object.keys(downloads));
        const prevIds = prevDownloadingRef.current;

        const justFinished = [...prevIds].some(id => !currentIds.has(id));

        prevDownloadingRef.current = currentIds;

        if (justFinished) {
            fetchtracks();
        }
    }, [downloads]);

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
                    renderItem={({ item }) => {
                        const entry = downloads[item.id];
                        return (
                            <Track 
                                Title={item.title} 
                                Artist={item.artist ?? 'Unknown Artist'}  
                                image={item.image ?? ''}
                                Downloaded={!!item.downloaded}
                                Progress={entry ? entry.bytesDownloaded / (entry.bytesTotal || 1):undefined}
                                Status={entry?.status}
                                onPausePress={() => downloadStore.pause(item.id)}
                                onResumePress={() => downloadStore.resume(item.id)}
                                onCancelPress={() => downloadStore.cancel(item.id)}
                                onStartPress={() => handlestartdownload(item)}
                            />
                        )
                    }}
                />
            )}
        </View>
    );
}