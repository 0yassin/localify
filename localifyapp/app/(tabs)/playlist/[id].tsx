import Track from "@/components/Track";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { type InferSelectModel, eq } from "drizzle-orm";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons"; 

type BaseTrackRow = InferSelectModel<typeof tracks>;

export default function Playlistscreen() {
    const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
    const router = useRouter(); 

    const [tracklist, setTracklist] = useState<BaseTrackRow[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchtracks = async () => {
        if (!id) return;
        try {
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

            <Text className='text-[25px] font-poppinsBold mb-4' numberOfLines={1}>
                {title || "Playlist Tracks"}
            </Text>

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