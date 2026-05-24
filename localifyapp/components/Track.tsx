import { View, Text, Image } from "react-native";
import { Shadow } from 'react-native-shadow-2';

interface Trackprops {
    Title: string;
    Downloaded: boolean;
    image: string | null; 
    Artist: string;
}

export default function Track({ Title, Downloaded, image, Artist }: Trackprops) {
    return (
        <View className="w-full mb-3">
            <Shadow 
                stretch 
                offset={[2, 2]} 
                distance={0} 
                startColor={'#000000'}
                style={{ borderRadius: 6 }} 
            >
                <View className="flex bg-card flex-row px-2 py-2 items-center gap-3 border-2 border-black rounded-[6px]">
                    
                    <Image 
                        source={{ 
                            uri: image || ''
                        }} 
                        className=" h-[64px] aspect-square rounded-[3px] bg-teal-800"
                    />
                    
                    <View className="flex-1">
                        <Text className="text-[18px] -mb-1 font-poppinsSemiBold" numberOfLines={1}>
                            {Title}
                        </Text>
                        <Text className="text[16px] font-poppinsMedium" numberOfLines={1}>
                            {Artist}
                        </Text>
                        
                        {/* <Text className="text-[14px] font-poppinsMedium mt-1 text-teal-400">
                            {Downloaded ? "Downloaded" : "Not yet"}
                        </Text> */}
                    </View>

                </View>
            </Shadow>
        </View>
    );
}