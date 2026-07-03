import React from 'react';
import { Image, Pressable, Text, View } from "react-native";

interface Trackprops {
    Title: string;
    Downloaded: boolean;
    image: string | null; 
    Artist: string;
    Progress: number | undefined;
    Status: string | undefined;
    onPausePress?: () => void;
    onResumePress?: () => void;
    onCancelPress?: () => void;
    onStartPress?: () => void;
}

const Track = React.memo(function Track({ Title, Downloaded, image, Artist, Progress, Status, onResumePress, onPausePress, onStartPress }: Trackprops) {
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

                    {Progress !== undefined && (
                        <View className='max-w-[30px]'>
                            <Text className="text-[16px] font-poppinsMedium" numberOfLines={1}>
                                {Math.round(Progress * 100)}%
                            </Text>
                        </View>
                    )}
                    {
                    Downloaded?
                         <View className={`aspect-square h-[28px] rounded-full mr-2 $ bg-[#1DB954]`}/>   
                        :

                         <View>
                            {Status === 'downloading' && (
                                <Pressable onPress={onPausePress}>
                                    <Image style={{ marginRight: 8, height: 28, width: 28 }} source={require("../assets/images/pause-icon.png")}/>
                                </Pressable>
                            )}
                            {Status === 'paused' && (
                                <Pressable onPress={onResumePress}>
                                    <Image style={{ marginRight: 8, height: 28, width: 28 }} source={require("../assets/images/play-icon.png")}/>
                                </Pressable>
                            )}
                            {!Status && (
                                <Pressable onPress={onStartPress}>
                                    <Image style={{ marginRight: 8, height: 28, width: 28 }} source={require("../assets/images/download-icon.png")}/>
                                </Pressable>
                            )}
                         </View>
                    }

                </View>
        </View>
    );
});

export default Track;
