
import Card from '@/components/Card';
import { Text, View } from 'react-native';
export default function TabOneScreen() {
  return (
    <View className='pt-16 px-6 bg-background h-full font-poppins flex flex-col'>
      {/* Header */}
      <View className='mb-16'>
        <Text className='text-[31px] font-poppinsBold'>Localify</Text>
      </View>

      <View>
        <Text className='text-[25px] font-poppinsBold mb-4'>Synced playlists</Text>
        <Card Title='Hello im card' Details='card thing' ImagePath='placeholder' />
      </View>
    </View>
  );
}


