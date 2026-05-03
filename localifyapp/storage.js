import AsyncStorage from "@react-native-async-storage/async-storage"

const storage_key = "@playlist_urls";

export const getplaylists = async () =>{
    try {
        const jsonValue = await AsyncStorage.getItem(storage_key)
        return jsonValue != null? JSON.parse(jsonValue) : [];
    } catch (e) {
    return [];
  }

}


export const addPlaylist = async (newUrl) => {
    const currentList = await getplaylists();
    if (currentList.includes(newUrl)) return currentList;
    const newList = [...currentList, newUrl];
    await AsyncStorage.setItem(storage_key, JSON.stringify(newList))
    return newList;
}

export const removePlaylist = async (Url) => {
    const currentList = await getplaylists();
    const newList = currentList.filter(url => url !== Url)
    await AsyncStorage.setItem(storage_key, JSON.stringify(newList))
    return newList
}
