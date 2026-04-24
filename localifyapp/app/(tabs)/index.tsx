
import { Text, View } from 'react-native';
export default function TabOneScreen() {
  return (
    <View className='bg-text'>
      <Text className="text-card bg-card text-2xl">This should be purple</Text>
      <Text className="text-red-500 bg-background">This should be red</Text>
    </View>
  );
}


