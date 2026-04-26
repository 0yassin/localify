import { View, Text } from "react-native"

interface CardProps{
    Title: string,
    ImagePath: string,
    Details: string,
}

export default function Card({Title, ImagePath, Details}: CardProps){
    return(
        <View className="flex flex-row px-3 py-3 items-center gap-4 border-2 border-black rounded-[6px]">
            <View className="bg-teal-800 p-10 aspect-square rounded-[4px]">
            </View>
            
            <View className="">
                <Text className="text-[18px] -mb-1 font-poppinsSemiBold">Playlist Name</Text>
                <Text className="text[16px] font-poppinsMedium">20 tracks</Text>
            </View>
        </View>
    )
}