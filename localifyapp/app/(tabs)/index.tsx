
import Card from '@/components/Card';
import { Text, View } from 'react-native';
export default function TabOneScreen() {
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

        <View className='w-full p-4 rounded-[6px] border-2 border-black/70 border-dashed flex-row items-center px-6 '>
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
      </View>
    </View>
  );
}


