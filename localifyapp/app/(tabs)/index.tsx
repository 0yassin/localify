import Card from '@/components/Card';
import { db } from '@/db/client';
import { playlists, tracks } from '@/db/schema';
import { Importplaylist } from '@/utils/Importplaylist';
import { StorageUtil } from '@/utils/Storage';
import { createDownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { and, count, eq, type InferSelectModel } from 'drizzle-orm';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Shadow } from 'react-native-shadow-2';



async function searchYoutube(query: string): Promise<string> {
    const searchurl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query}`)}`

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); 

      const res = await fetch(searchurl, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5"
            }
        });
      clearTimeout(timeoutId)

      if(!res.ok) {
        throw new Error(`Youtube error: ${res.status}`)
      }

      const html = await res.text();

      const videoRendererRegex = /"videoRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/;
      const match = html.match(videoRendererRegex);

      if (match && match[1]) {
            return match[1];
      }

      const fallbackRegex = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/;
      const fallbackMatch = html.match(fallbackRegex);
      if (fallbackMatch && fallbackMatch[1]) {
          return fallbackMatch[1];
      }

      throw new Error("Target video coudl not be extracted from YouTube response.");

    } 

    catch (err) {
      console.error("YouTube scraper exception:", err);
      throw new Error("Search execution failed");
    }
}


async function fetchAudio(url:string){
  console.log(url) // this works so far
  return ''
  
}



type BasePlaylistRow = InferSelectModel<typeof playlists>;

interface playlistInterface extends BasePlaylistRow {
  trackCount: number;
}

export default function TabOneScreen() {
  const [Input_playlist_url, setInput_playlist_url] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Importing tracks from Spotify...');
  const [allPlaylists, setAllPlaylists] = useState<playlistInterface[]>([]);
  const [folder, setFolder] = useState<string | null>(null);



   const fetchPlaylists = async () => {

    try {
      const result = await db.select({
        id: playlists.id,
        name: playlists.name,
        icon: playlists.icon,
        trackCount: count(tracks.id),
        url: playlists.url,
        lastChecked: playlists.lastChecked
      }).from(playlists).leftJoin(tracks, eq(playlists.id, tracks.playlist)).groupBy(playlists.id);

      setAllPlaylists(result);
      } catch (error) {
        console.error("Failed to load local playlists:", error);
      }

  };


  useEffect(() => {
    fetchPlaylists();
    async function loadsavedir() {
    const savedpath = await StorageUtil.GetFolder();
          if (savedpath) setFolder(savedpath);
        }
        loadsavedir();
      }, []);





  const handleAdd = async () => {
    let activeFolder = folder;
    const cleanPlaylistUrl = Input_playlist_url.trim();

    if (!activeFolder) {
      const dbFolderCheck = await StorageUtil.GetFolder();
      if (dbFolderCheck) {
        activeFolder = dbFolderCheck;
        setFolder(dbFolderCheck);
      }
    }

    if (!activeFolder) {
      const picked_path = await StorageUtil.SaveFolder();
      if (!picked_path) {
        alert("Please pick a download folder, this is where your music will be stored.");
        return; 
      }
      activeFolder = picked_path; 
      setFolder(picked_path);
    }

    if (!cleanPlaylistUrl) return;

    try {
      setLoading(true);
      setLoadingStatus('Importing playlist track data...');
      
      await Importplaylist(cleanPlaylistUrl, () => {});
      await fetchPlaylists();
      
      if (activeFolder) {
        const nativeTargetFolder = activeFolder.startsWith('file://') 
          ? activeFolder.replace('file://', '') 
          : activeFolder;

        const targetPlaylist = await db.query.playlists.findFirst({
          where: eq(playlists.url, cleanPlaylistUrl)
        });

        if (targetPlaylist) {
          const pendingTracks = await db.select()
            .from(tracks)
            .where(and(eq(tracks.playlist, targetPlaylist.id), eq(tracks.downloaded, false)));

          const urlManifest: { trackId: string; title: string; directUrl: string }[] = [];

          for (let i = 0; i < pendingTracks.length; i++) {
            const track = pendingTracks[i];
            
            setLoadingStatus(`Resolving links (Keep app open):\n"${track.title}" (${i + 1}/${pendingTracks.length})`);

            if (track.ytlink && track.ytlink.length > 1) {
              try {
                const Mp3Url = await fetchAudio(track.ytlink);
                
                urlManifest.push({
                  trackId: track.id,
                  title: track.title,
                  directUrl: Mp3Url
                });
              } catch (err) {
                console.error(`Skipped track link generation for ${track.title}:`, err);
              }
            } else {
              try {
                const vidID = await searchYoutube(`${track.title} - ${track.artist}`);
                const permanentYtUrl = `https://www.youtube.com/watch?v=${vidID}`;
                const Mp3Url = await fetchAudio(permanentYtUrl);

                await db.update(tracks)
                  .set({ ytlink: permanentYtUrl })
                  .where(eq(tracks.id, track.id));
              
                urlManifest.push({
                  trackId: track.id,
                  title: track.title,
                  directUrl: Mp3Url
                });
              } catch (err) {
                console.error(`Skipped track link generation for ${track.title}:`, err);
              }
            }
          }

          setLoadingStatus("starting background downloads");
          
          for (const item of urlManifest) {
            const task = createDownloadTask({
                id: item.trackId.toString(),
                url: item.directUrl,
                destination: `${nativeTargetFolder}/${item.trackId}.mp3`
            });

            task.begin((expectedBytes) => {})
                .done(async () => {
                  await db.update(tracks)
                    .set({ downloaded: true, filename: `${item.trackId}.mp3` })
                    .where(eq(tracks.id, item.trackId));
                })
                .error((error) => {
                  console.error(`bg download worker failed for track ID ${item.trackId}:`, error);
                });

            task.start();
          }
        }
      }

      setInput_playlist_url('');
      setModalVisible(false);
      setLoading(false);
      
      alert("Download tasks successfully queued! You can now close the app.");

    } catch (err) {
      setModalVisible(false);
      setLoading(false);
      setInput_playlist_url('');
      console.error(err);
      alert("An unexpected error occurred during sync initialization.");
    }
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

          {allPlaylists.map((playlist) => (
            <Link 
              key={playlist.id}
              href={{
                pathname: "./playlist/[id]",
                params: { id: playlist.id, title: playlist.name }
              }}                
              asChild
            >
              <Pressable>
                <Card Title={playlist.name} Details={`${playlist.trackCount} tracks`} ImagePath={playlist.icon || "placeholder"} />
              </Pressable>
            </Link>
          ))}

          <Pressable onPress={() => { if (!loading) setModalVisible(true); }} className='w-full p-4 rounded-[6px] border-2 border-black/70 border-dashed flex-row items-center px-6 '>
            <View className='flex flex-row justify-between items-center w-full'> 
              <Text className='text-[18px] font-poppinsMedium text-textColor/70  '>Add playlist</Text>
              <Text className='text-[21px] font-poppinsMedium  text-textColor/70'>+</Text>
            </View>
          </Pressable>

        </View>

        <Modal 
          animationType='fade'
          visible={modalVisible} 
          onRequestClose={() => { if (!loading) setModalVisible(false); }}
          transparent={true}
        >
          <Pressable onPress={(e) => { if (e.target === e.currentTarget && !loading) setModalVisible(false); }} className='bg-black/40 justify-center items-center flex-1 px-6 '>
            <Shadow 
              offset={[2, 2]} 
              distance={0} 
              startColor={'#000000'}
              style={{ borderRadius: 6, alignSelf: 'stretch' }}
              containerStyle={{ width: '100%' }} 
            >
              <View className='bg-white w-full py-6 rounded-[6px] gap-4 border-black border-2 px-4'>
                
                {loading ? (
                  <View className='py-4 flex flex-col items-center justify-center gap-4'>
                    <ActivityIndicator size={'large'} color={'#1DB954'} /> 
                    <Text className='font-poppinsMedium text-[14px] text-center text-black/80 px-2'>
                      {loadingStatus}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Shadow 
                      offset={[2, 2]} 
                      distance={0} 
                      startColor={'#000000'}
                      style={{ borderRadius: 4, alignSelf: 'stretch' }}
                      containerStyle={{ width: '100%' }} 
                    >
                      <TextInput 
                        value={Input_playlist_url} 
                        onChangeText={setInput_playlist_url} 
                        placeholder='Enter spotify playlist link' 
                        className='bg-white border-2 text-[16px] font-poppinsMedium px-4 py-4 border-black rounded-[4px]'
                      />
                    </Shadow>

                    <Shadow 
                      offset={[2, 2]} 
                      distance={0} 
                      startColor={'#191414'}
                      style={{ borderRadius: 4, alignSelf: 'stretch' }}
                      containerStyle={{ width: '100%' }} 
                    >
                      <Pressable onPress={handleAdd} className='bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                        <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>
                          Add Playlist
                        </Text>
                      </Pressable>
                    </Shadow>
                  </>
                )}

              </View>
            </Shadow>
          </Pressable>
        </Modal>

      </View>
    </View>
  );
}