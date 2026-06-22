import { View, Text, Image } from "react-native";
import { Shadow } from 'react-native-shadow-2';
import React from 'react'; 

interface Trackprops {
    Title: string;
    Downloaded: boolean;
    image: string | null; 
    Artist: string;
}

const Track = React.memo(function Track({ Title, Downloaded, image, Artist }: Trackprops) {
    return (
        <View className="w-full">

            <View className="absolute top-[2px] left-[2px] right-[-2px] bottom-[-2px] bg-black rounded-[6px]" />
                <View className="w-full flex bg-card flex-row px-2 py-2 items-center gap-3 border-2 border-black rounded-[6px]">
                    
                    <Image 
                        source={{ 
                            uri: image || ''
                        }} 
                        className="h-[64px] border-black border-2 aspect-square rounded-[3px] bg-teal-800"
                    />
                    
                    <View className="flex-1 ">
                        <Text className="text-[18px] -mb-1 font-poppinsSemiBold" numberOfLines={1}>
                            {Title}
                        </Text>
                        <Text className="text-[16px] font-poppinsMedium" numberOfLines={1}>
                            {Artist}
                        </Text>
                    </View>
                    
                    <View className={`aspect-square h-[28px] rounded-full mr-2 ${Downloaded? "bg-[#1DB954]":"bg-[#D43D2C]"} `}>
                    </View>
                </View>
        </View>
    );
});

export default Track;
