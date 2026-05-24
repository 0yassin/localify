import Track from "@/components/Track";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import {type InferSelectModel, eq } from "drizzle-orm";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View , Text} from "react-native";
import { FlatList } from "react-native";


type BaseTrackRow = InferSelectModel<typeof tracks>;


export default function Playlistscreen(){

    const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();

    const [tracklist, SetTracklist] = useState<BaseTrackRow[]>([])
    const [Loading, SetLoading] = useState(false)

    const fetchtracks = async () => {
        if (!id) return;
        try{
            SetLoading(true)
            const results = await db
            .select()
            .from(tracks)
            .where(eq(tracks.playlist, Number(id)))

            SetTracklist(results)
        }

        catch (error) {
            console.error("Failed to load tracks for playlist:", error);        
        
        }

        finally {
            SetLoading(false)
        }
    };

    useEffect(() => {
        fetchtracks();
    }, [id]);


    return(
        <View className="flex-1 bg-white px-6 pt-12">

            {/* <View className='mb-16'> */}
                <Text className='text-[31px] font-poppinsBold'>Localify</Text>
            {/* </View> */}

            {Loading? 
            
                <ActivityIndicator size={'large'} color={'#161616'}  className="flex-1 justify-center items-center"/>

                :

                <FlatList data={tracklist} keyExtractor={(item) => item.id} ListEmptyComponent={<Text>No tracks imported in this playlist yet.</Text>} 
                    renderItem={({item}) => (

                        <Track 
                        Title={item.title} 
                        Artist={item.artist ?? 'Artist'}  
                        image={item.image ?? ''}
                        Downloaded={!!item.downloaded}/>
                        
                        // <View><Text>{String(JSON.stringify(item))}</Text></View>
                    )}

                
                />
                
            }



        </View>
    )

}