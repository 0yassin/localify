import { db } from "@/db/client";
import { playlists, tracks } from "@/db/schema";
import { withDbLock } from "@/utils/dbMutex";
import { eq } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { Shadow } from 'react-native-shadow-2';

interface CardProps{
    ID: string,
    isDownloading: boolean,
    activeCount: number,
}
interface PlaylistData{
    Image: string | null,
    Title: string,
    TrackCount: number,
    DownloadedCount:number,
}

async function GetPlaylistData(ID:string){
    const trackres = await withDbLock(()=>db.select().from(tracks).where(eq(tracks.playlist, ID)))
    const trk_count = trackres.length
    const dwn_count = trackres.filter(track=>track.downloaded === true).length

    const [result] = await withDbLock(()=>db
        .select({
            Title:playlists.name,
            Image:playlists.icon,
        })
        .from(playlists)
        .where(eq(playlists.id, ID))
    )

    const pl_data: PlaylistData = {
        Title: result.Title,
        Image: result.Image,
        DownloadedCount: dwn_count,
        TrackCount:trk_count,
    }

    return pl_data
}


export default function Card({ID, isDownloading, activeCount}: CardProps){
    const [Playlist, setPlaylist] = useState<PlaylistData>()
    const [loading, setloading] = useState(false)

    async function load_data() {
      if(!ID) return
        try{
            setloading(true)
            setPlaylist(await GetPlaylistData(ID))
        }
        catch (e){
            console.error(e)
        }
        finally {
            setloading(false)
        }
    }

    useFocusEffect(useCallback(()=>{
        load_data()
    },[]))

    
    return(
    <View className="w-full">
    <Shadow stretch 
    
      offset={[2, 2]} 
      distance={0} 
      startColor={'#000000'}
      style={{ borderRadius: 6 }} 
    >
        <View className={`flex bg-card border-2 border-black rounded-[6px]`}>
          <View className="flex-row justify-between px-2 py-2 items-center gap-3  ">

            <View className="flex flex-row gap-2 items-center">
            <Image 
                source={{ 
                    uri: Playlist?.Image || ''
                }} 
                className=" h-[70px] aspect-square rounded-[3px] bg-teal-800 border-2 border-black"
                />
            
            <View className="">
                <Text className="text-[18px] -mb-1 font-poppinsSemiBold">{Playlist?.Title}</Text>
                {isDownloading?
                    <Text className="text-[16px] font-poppinsMedium">{activeCount} Downloading</Text>

                :
                    <Text className="text-[16px] font-poppinsMedium">{Playlist?.DownloadedCount}/{Playlist?.TrackCount} Tracks</Text>
                }
            </View>
            </View>
            {isDownloading&&(
                <ActivityIndicator size={'large'} style={{transform:'scale(0.8)'}} className="h-[24px] w-[24px] mr-2"/>
            )}
          </View>

        </View>
    </Shadow>
    </View>
    )
}