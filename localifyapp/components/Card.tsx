import { View, Text, Image } from "react-native"
import { Shadow } from 'react-native-shadow-2';

interface CardProps{
    Title: string,
    ImagePath: string,
    Details: string,
    
}

export default function Card({Title, ImagePath, Details}: CardProps){
    return(
    <View className="w-full">
    <Shadow stretch 
    
      offset={[2, 2]} 
      distance={0} 
      startColor={'#000000'}
      style={{ borderRadius: 6 }} 
    >
        <View className="flex bg-card flex-row px-2 py-2 items-center gap-3 border-2 border-black rounded-[6px]">
                    <Image 
                        source={{ 
                            uri: ImagePath || ''
                        }} 
                        className=" h-[64px] aspect-square rounded-[3px] bg-teal-800"
                    />
            
            <View className="">
                <Text className="text-[18px] -mb-1 font-poppinsSemiBold">{Title}</Text>
                <Text className="text[16px] font-poppinsMedium">{Details}</Text>
            </View>
        </View>
    </Shadow>
    </View>
    )
}