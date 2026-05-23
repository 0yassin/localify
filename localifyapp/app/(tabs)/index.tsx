import Card from '@/components/Card';
import {ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Shadow } from 'react-native-shadow-2';
import { Importplaylist } from '@/components/Importplaylist';
import { db } from '@/db/client';
import { playlists, tracks } from '@/db/schema';
import { count, eq, type InferSelectModel } from 'drizzle-orm';


type BasePlaylistRow = InferSelectModel<typeof playlists>;

interface playlistInterface extends BasePlaylistRow{
  trackCount: number
}

export default function TabOneScreen() {

  const [Input_playlist_url, setInput_playlist_url] = useState('');
  const [modalVisible, setModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const [allPlaylists, setAllPlaylists] = useState<playlistInterface[]>([]);

    const fetchPlaylists = async () => {
      try {
        const result = await db.select({

          id: playlists.id,
          name: playlists.name,
          icon: playlists.icon,
          trackCount: count(tracks.id),
          url: playlists.url,
          lastChecked: playlists.lastChecked

      }).from(playlists).leftJoin(tracks, eq(playlists.id, tracks.playlist)).groupBy(playlists.id);
        setAllPlaylists(result); 
      } catch (error) {
        console.error("Failed to load local playlists:", error);
      }
    };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleAdd = async () => {

    if (!Input_playlist_url.trim()) return;
    try{
      await Importplaylist(Input_playlist_url, setLoading);
      setInput_playlist_url('');
      setModalVisible(false);
      await fetchPlaylists();
    }
    catch(err){
      setModalVisible(false)
      setInput_playlist_url('');
      console.error(err)
    }
  };


  return (
    <View className='pt-16 px-6 bg-background h-full font-poppins flex flex-col'>
      {/* Header */}
      <View className='mb-16'>
        <Text className='text-[31px] font-poppinsBold'>Localify</Text>
      </View>

      <View className=''>
        <Text className='text-[25px] font-poppinsBold mb-4'>Synced playlists</Text>
        <View className='gap-3 flex flex-col'>


        {
            
            
             allPlaylists.map((playlist, index) => (
                <Card key={index} Title={playlist.name} Details={`${playlist.trackCount} tracks`} ImagePath={playlist.icon || "placeholder"} />
             ))


          }


        <View onTouchEnd={()=>setModalVisible(true)} className='w-full p-4 rounded-[6px] border-2 border-black/70 border-dashed flex-row items-center px-6 '>
          <View className='flex flex-row justify-between items-center w-full'> 
            <Text className='text-[18px] font-poppinsMedium text-textColor/70  '>Add playlist</Text>
            <Text className='text-[21px] font-poppinsMedium  text-textColor/70'>+</Text>
          </View>
          <View>
            <Text className='text-[18px] text-white font-poppinsSemiBold -m-1'></Text>
            <Text className="text-[16px] text-white/70 font-poppinsMedium"></Text>
          </View>
          </View>

        </View>

        <Modal animationType='fade'
          visible={modalVisible} 
          onRequestClose={() => setModalVisible(false)}
          transparent={true}
        >

          <Pressable onPress={(e)=>{if (e.target === e.currentTarget) setModalVisible(false);}} className='bg-black/40 justify-center items-center flex-1 px-6 '>
            <Shadow 
              
                offset={[2, 2]} 
                distance={0} 
                startColor={'#000000'}
                style={{ borderRadius: 6, alignSelf:'stretch'}}
                containerStyle={{ width: '100%' }} 
                
            >

              <View className='bg-white w-full py-6 rounded-[6px] gap-2 border-black border-2 px-4'>
                <Shadow 
                  offset={[2, 2]} 
                  distance={0} 
                  startColor={'#000000'}
                  style={{ borderRadius: 4, alignSelf:'stretch'}}
                  containerStyle={{ width: '100%' }} 
                >
                  <TextInput value={Input_playlist_url} onChangeText={setInput_playlist_url} placeholder='Enter spotify playlist link' className=' bg-white border-2 text-[16px] font-poppinsMedium px-4 py-4 border-black rounded-[4px]'></TextInput>

              </Shadow>


              <Shadow 
                  offset={[2, 2]} 
                  distance={0} 
                  startColor={'#191414'}
                  style={{ borderRadius: 4, alignSelf:'stretch'}}
                  containerStyle={{ width: '100%' }} 
                >
                  <Pressable onPress={handleAdd} className=' bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                    {loading? 
                    
                      <ActivityIndicator size={'large'} color={'#191414'} /> 
                      : 
                      <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>Add Playlist</Text>

                    }
                  </Pressable>

              </Shadow>


              </View>
            </Shadow>
          </Pressable>


        </Modal>

      </View>
    </View>
  );
}


