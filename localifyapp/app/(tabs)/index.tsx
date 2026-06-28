import { downloadAndStore, ManifestItem, resolveTrackLink } from '@/components/DownloadTracks';
import Playlist from '@/components/Playlist';
import { db } from '@/db/client';
import { playlists, tracks, user } from '@/db/schema';
import { Importplaylist } from '@/utils/Importplaylist';
import { StorageUtil } from '@/utils/Storage';
import { and, eq } from 'drizzle-orm';
import { Checkbox } from 'expo-checkbox';
import * as FileSystem from 'expo-file-system/legacy';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Shadow } from 'react-native-shadow-2';

const RESOLVE_CONCURRENCY = 4;
const DOWNLOAD_CONCURRENCY = 3;

interface Playlist_ {
  id: number,
  name:string,
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await fn(items[current], current);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function SyncDownloadWithDB(): Promise<boolean> {
  const downloadedTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.downloaded, true));
  let changed = false;

  for (const track of downloadedTracks) {
    if (!track.filename) {
      await db
        .update(tracks)
        .set({
          downloaded: false,
          filename: null,
        })
        .where(eq(tracks.id, track.id));

      changed = true;
      continue;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(track.filename);

      if (!fileInfo.exists) {
        await db
          .update(tracks)
          .set({
            downloaded: false,
            filename: null,
          })
          .where(eq(tracks.id, track.id));

        changed = true;
      }
    } catch (e) {
      console.error(`Sync error for ${track.id}:`, e);

      await db
        .update(tracks)
        .set({
          downloaded: false,
          filename: null,
        })
        .where(eq(tracks.id, track.id));

      changed = true;
    }
  }
  const folder = await db.select({folder: user.folder}).from(user).where(eq(user.id, 1)).limit(1)
  if (folder[0].folder != null){
      const fs_tracks = await FileSystem.readDirectoryAsync(folder[0].folder)
      
  }

  return changed;
}

export default function TabOneScreen() {
  const [inputPlaylistUrl, setInputPlaylistUrl] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [allPlaylists, setAllPlaylists] = useState<Playlist_[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [plmenuVisible, setplmenuVisible] = useState(false)
  const [selectedpl, setselectedpl] = useState<Playlist_>()
  const [deltrackstoggle, setdeltrackstoggle] = useState(false)

  const RerenderPlaylists = async () => {
    const result = await db
      .select({
        id: playlists.id,
        name:playlists.name,
      })
      .from(playlists)
      .leftJoin(tracks, eq(playlists.id, tracks.playlist))
      .groupBy(playlists.id);

    setAllPlaylists(result);
  };

  const fetchPlaylists = async () => {
    try {
      const changed = await SyncDownloadWithDB();

      await RerenderPlaylists();

      if (changed) {
        await RerenderPlaylists();
      }
    } catch (error) {
      console.error('Failed to load local playlists:', error);
    }
  };

  useEffect(() => {
    async function init() {
      const savedpath = await StorageUtil.GetFolder();

      if (savedpath) {
        setFolder(savedpath);
      }

      await fetchPlaylists();
    }
    init();
  }, []);

  const handleAdd = async () => {
    console.log('wdad')
    let activeFolder = folder;
    const cleanPlaylistUrl = inputPlaylistUrl.trim();

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
        Alert.alert('Pick a folder', 'Please pick a download folder, this is where your music will be stored.');
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

      const targetPlaylist = await db.query.playlists.findFirst({
        where: eq(playlists.url, cleanPlaylistUrl),
      });

      let resolveFailures = 0;
      let downloadFailures = 0;
      let downloadSuccesses = 0;

      if (targetPlaylist) {
        const pendingTracks = await db
          .select()
          .from(tracks)
          .where(and(eq(tracks.playlist, targetPlaylist.id), eq(tracks.downloaded, false)));

        let resolvedCount = 0;
        const manifestResults = await mapWithConcurrency(pendingTracks, RESOLVE_CONCURRENCY, async (track) => {
          const result = await resolveTrackLink(track);
          resolvedCount++;
          setLoadingStatus(`Resolving links (Keep app open): ${resolvedCount}/${pendingTracks.length}`);
          return result;
        });

        const urlManifest = manifestResults.filter((item): item is ManifestItem => item !== null);
        resolveFailures = pendingTracks.length - urlManifest.length;

        if (urlManifest.length >= 0) {
          let completedCount = 0;
          const downloadResults = await mapWithConcurrency(urlManifest, DOWNLOAD_CONCURRENCY, async (item) => {
            const result = await downloadAndStore(item, activeFolder as string);
            completedCount++;
            setLoadingStatus(`Downloading: ${completedCount}/${urlManifest.length}`);
            return result;
          });

          downloadSuccesses = downloadResults.filter((r) => r.success).length;
          downloadFailures = downloadResults.filter((r) => !r.success).length;
        }

        await fetchPlaylists();
      }

      setInputPlaylistUrl('');
      setModalVisible(false);
      setLoading(false);

      const lines = [`${downloadSuccesses} track${downloadSuccesses === 1 ? '' : 's'} downloaded.`];
      if (resolveFailures > 0) {
        lines.push(`${resolveFailures} track${resolveFailures === 1 ? '' : 's'} couldn't be matched to a source.`);
      }
      if (downloadFailures > 0) {
        lines.push(`${downloadFailures} download${downloadFailures === 1 ? '' : 's'} failed.`);
      }
      Alert.alert('Sync complete', lines.join('\n'));
      fetchPlaylists()
    } catch (err) {
      setModalVisible(false);
      setLoading(false);
      setInputPlaylistUrl('');
      console.error(err);
      Alert.alert('Something went wrong', 'An unexpected error occurred during sync initialization.');
    }
  };

  const handledelete = async () => {
    fetchPlaylists()
    SyncDownloadWithDB()
    try{
      if (!selectedpl) return
        try{
          await db.delete(playlists).where(eq(playlists.id, selectedpl.id))
        }
        catch (e){
          console.log("playlist deleteion from db error:", e)
        }
        if(deltrackstoggle){
          const del_queue = await db.select().from(tracks).where(eq(tracks.playlist, selectedpl.id))
          for (const track of del_queue){
            if (track.filename){
              try{
                await FileSystem.deleteAsync(track.filename)     
                await db.delete(tracks).where(eq(tracks.filename, track.filename))           
              }
              catch (e){
                console.log("Track deletion from filesystem error:", e)
              }
            }
          }
        }
    }
    catch (e){
      console.error(e)
    }
    fetchPlaylists()
    SyncDownloadWithDB()
  }

  return (
    <View className='pt-16 px-6 bg-background h-full font-poppins flex flex-col'>
      {/* Header */}
      <View className='mb-2'>
        <Text className='text-[31px] font-poppinsBold'>Localify</Text>
      </View>

      {loading? 
        (<View className='text-[16px] w-full mb-8'>
          <View className='bg-black pr-[3px] pl-[2px] pt-[2px] pb-[3px] rounded-[5px]'>
            <View className='bg-white rounded-[3px] p-3'>
              <Text className='font-poppins text-[16px] text-black'>{loadingStatus}</Text>
            </View>
          </View>

        </View>)
       : 
        (<></>)
      }

      <View className=''>
        <View className='w-full flex justify-between flex-row items-center'>
          <Text className='text-[25px] font-poppinsBold mb-2'>Synced playlists</Text>
          <Pressable onPress={()=>{fetchPlaylists()}} className='bg-green-500 aspect-square h-10'><Text className='w-full h-full text-center'>Rel</Text></Pressable>
        </View>
        <View className='gap-3 flex flex-col'>

          {allPlaylists.map((playlist) => (
            <Link
              key={playlist.id}
              href={{
                pathname: './playlist/[id]',
                params: { id: playlist.id, title: playlist.name },
              }}
              asChild
            >
              <Pressable onLongPress={()=>{setplmenuVisible(true); setselectedpl(playlist)}}>
                <Playlist ID={playlist.id}/>
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
          <Pressable onPress={(e) => { if (e.target === e.currentTarget) setModalVisible(false); }} className='bg-black/40 justify-center items-center flex-1 px-6 '>
            <Shadow
              offset={[2, 2]}
              distance={0}
              startColor={'#000000'}
              style={{ borderRadius: 6, alignSelf: 'stretch' }}
              containerStyle={{ width: '100%' }}
            >
              <View className='bg-white w-full py-6 rounded-[6px] gap-4 border-black border-2 px-4'>

                  <>
                    <Shadow
                      offset={[2, 2]}
                      distance={0}
                      startColor={'#000000'}
                      style={{ borderRadius: 4, alignSelf: 'stretch' }}
                      containerStyle={{ width: '100%' }}
                    >
                      <TextInput
                        value={inputPlaylistUrl}
                        onChangeText={setInputPlaylistUrl}
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
                      <Pressable onPress={()=>{handleAdd();setModalVisible(false)}} className='bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                        <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>
                          Add Playlist
                        </Text>
                      </Pressable>
                    </Shadow>
                  </>
              </View>
            </Shadow>
          </Pressable>
        </Modal>
        
        <Modal visible={plmenuVisible} animationType='fade' transparent={true} onRequestClose={()=>setplmenuVisible(false)}>
          <Pressable onPress={(e) => { if (e.target === e.currentTarget) setplmenuVisible(false); setdeltrackstoggle(false) }} className='bg-black/40 justify-center items-center flex-1 px-6 '>
            <Shadow
              offset={[2, 2]}
              distance={0}
              startColor={'#000000'}
              style={{ borderRadius: 6, alignSelf: 'stretch' }}
              containerStyle={{ width: '100%' }}
            >
              <View className='bg-white w-full py-6 rounded-[6px] gap-4 border-black border-2 px-4'>
                  <>
                  <View className='flex flex-row justify-between'>
                    <Text className='text-[16px] font-poppins'>Delete tracks from device</Text>
                    <Checkbox color={deltrackstoggle? '#D43D2C' : ''} value={deltrackstoggle} onValueChange={setdeltrackstoggle} />
                  </View>
                    <Shadow
                      offset={[2, 2]}
                      distance={0}
                      startColor={'#191414'}
                      style={{ borderRadius: 4, alignSelf: 'stretch' }}
                      containerStyle={{ width: '100%' }}
                    >
                      <Pressable onPress={()=>{handledelete();setplmenuVisible(false);setdeltrackstoggle(false)}} className='bg-[#D43D2C] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                        <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>
                          Delete playlist
                        </Text>
                      </Pressable>
                    </Shadow>
                  </>
              </View>
            </Shadow>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}