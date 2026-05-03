import {getplaylists, addPlaylist} from '@/storage'
import Card from '@/components/Card';
import {Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Shadow } from 'react-native-shadow-2';
export default function TabOneScreen() {
  const [urls, setUrls] = useState([]);
  const [inputText, setInputText] = useState('');
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    const load = async () => {
      const saved = await getplaylists();
      setUrls(saved);
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (inputText == "") return 
    const updatedList = await addPlaylist(inputText);
    setUrls(updatedList);
    setModalVisible(false)
    setInputText('');
    
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

        <Card Title='peak songs' Details='20 tracks' ImagePath='placeholder' />
        <Card Title='peak songs' Details='20 tracks' ImagePath='placeholder' />

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
                  <TextInput value={inputText} onChangeText={setInputText} placeholder='Enter spotify playlist link' className=' bg-white border-2 text-[16px] font-poppinsMedium px-4 py-4 border-black rounded-[4px]'></TextInput>

              </Shadow>


              <Shadow 
                  offset={[2, 2]} 
                  distance={0} 
                  startColor={'#191414'}
                  style={{ borderRadius: 4, alignSelf:'stretch'}}
                  containerStyle={{ width: '100%' }} 
                >
                  <Pressable onPress={handleAdd} className=' bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'><Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>Add Playlist</Text></Pressable>

              </Shadow>


              </View>
            </Shadow>
          </Pressable>


        </Modal>

      </View>
    </View>
  );
}


