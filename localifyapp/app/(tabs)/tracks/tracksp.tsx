
import Track from "@/components/Track";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { useDownloads } from "@/hooks/useDownloads";
import { downloadStore } from "@/utils/DownloadStore";
import { retryTrackDownload } from "@/utils/DownloadTracks";
import { StorageUtil } from "@/utils/Storage";
import { SyncDownloadWithDB } from "@/utils/SyncDownloadWithDB";
import { Ionicons } from "@expo/vector-icons";
import { eq, InferSelectModel } from "drizzle-orm";
import * as Filesystem from 'expo-file-system/legacy';
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Shadow } from "react-native-shadow-2";


type BaseTrackRow = InferSelectModel<typeof tracks>;


export default function trackspage(){
    const [tracklist, setTracklist] = useState<BaseTrackRow[]>([]);
    const [loading, setLoading] = useState(false)
    const [TrackModalVisible, setTrackModalVisible] = useState(false)
    const [TrackModalLoading, setTrackModalLoading] = useState(false)
    const [ActiveTasks, setActiveTasks] = useState<any>([])
    const [SelectedTrack, setSelectedTrack] = useState('')
    const downloads = useDownloads();
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

    const fetchtracks = async () => {
        try{
            setLoading(true)
            SyncDownloadWithDB()
            const result = await db.select().from(tracks)
            setTracklist(result)
        }

        catch(e){
            console.error("error fetching tracks", e)
        }
        finally{
            setLoading(false)
        }
    }

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

    useEffect(()=>{
        fetchtracks()
    }, [])

    const handledelete = async () => {
        try{
            const res = await db.select().from(tracks).where(eq(tracks.id, SelectedTrack)).limit(1)
            if (res[0].filename){
                await Filesystem.deleteAsync(res[0].filename)
            }
            await db.delete(tracks).where(eq(tracks.id, SelectedTrack))

        }
        catch (e){
            console.error("error while trying to delete track", e)
        }
        finally{
            setTrackModalLoading(false)
            setTrackModalVisible(false)
        }
    }
    
    return(
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
                All tracks
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
                        return(
                            <Pressable onLongPress={()=>{setTrackModalVisible(true); setSelectedTrack(item.id)}}>
                        
                        <Track     
                            Title={item.title} 
                            Artist={item.artist ?? 'Unknown Artist'}  
                            image={item.image ?? ''}
                            Downloaded={!!item.downloaded}
                            Progress={entry ? entry.bytesDownloaded / (entry.bytesTotal || 1) : undefined}
                            Status={entry?.status}
                            onPausePress={() => downloadStore.pause(item.id)}
                            onResumePress={() => downloadStore.resume(item.id)}
                            onCancelPress={() => downloadStore.cancel(item.id)}
                            onStartPress={()=>handlestartdownload(item)}
                            
                            />
                        </Pressable>
                        )
                    }}
                />
            )}

            <Modal visible={TrackModalVisible} animationType='fade' transparent={true} onRequestClose={()=>setTrackModalVisible(false)}>
                <Pressable onPress={(e) => { if (e.target === e.currentTarget) setTrackModalVisible(false); setTrackModalVisible(false) }} className='bg-black/40 justify-center items-center flex-1 px-6 '>
                    <Shadow
                      offset={[2, 2]}
                      distance={0}
                      startColor={'#000000'}
                      style={{ borderRadius: 6, alignSelf: 'stretch' }}
                      containerStyle={{ width: '100%' }}
                    >
                        <View className='bg-white w-full py-6 rounded-[6px] gap-4 border-black border-2 px-4'>
                            <>
                                <Shadow
                                    offset={[2, 2]}
                                    distance={0}
                                    startColor={'#191414'}
                                    style={{ borderRadius: 4, alignSelf: 'stretch' }}
                                    containerStyle={{ width: '100%' }}
                                >
                                    <Pressable onPress={()=>{handledelete();setTrackModalLoading(true)}} className='bg-[#D43D2C] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                                        <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>
                                            Delete Track
                                        </Text>
                                    </Pressable>
                                </Shadow>
                            </>
                        </View>
                    </Shadow>
                </Pressable>
            </Modal>
        </View>
    )
}