import PlaylistRow from '@/components/PlaylistRow';
import { db } from '@/db/client';
import { playlists, tracks } from '@/db/schema';
import { useDownloads } from '@/hooks/useDownloads';
import { withDbLock } from '@/utils/dbMutex';
import { downloadStore } from '@/utils/DownloadStore';
import { downloadAndStore, ManifestItem, resolveTrackLink } from '@/utils/DownloadTracks';
import { Importplaylist } from '@/utils/Importplaylist';
import { StorageUtil } from '@/utils/Storage';
import { and, eq } from 'drizzle-orm';
import { Checkbox } from 'expo-checkbox';
import * as FileSystem from 'expo-file-system/legacy';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Shadow } from 'react-native-shadow-2';
import { BaseTrackRow } from './tracks/tracksp';

const RESOLVE_CONCURRENCY = 4;
const DOWNLOAD_CONCURRENCY = 3;

interface Playlist_ {
  id: string,
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



export default function TabOneScreen() {
  const [inputPlaylistUrl, setInputPlaylistUrl] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allPlaylists, setAllPlaylists] = useState<Playlist_[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [plmenuVisible, setplmenuVisible] = useState(false)
  const [selectedpl, setselectedpl] = useState<Playlist_>()
  const [deltrackstoggle, setdeltrackstoggle] = useState(false)
  const [playlistTrackIds, setPlaylistTrackIds] = useState<Record<string, string[]>>({});
  const [tracklist, setTracklist] = useState<BaseTrackRow[]>([]);
  const downloads = useDownloads();
  const activeDownloads = Object.entries(downloads).map(([trackId, entry]) => ({
    trackId,
    ...entry,
  }));

  const fetchPlaylists = async () => {
      try {
          const [playlistRows, allTracks] = await withDbLock(() =>
              Promise.all([
                  db.select({ id: playlists.id, name: playlists.name })
                      .from(playlists)
                      .leftJoin(tracks, eq(playlists.id, tracks.playlist))
                      .groupBy(playlists.id),
                  db.select().from(tracks),
              ])
          );

          setAllPlaylists(playlistRows);
          setTracklist(allTracks);

          const grouped: Record<string, string[]> = {};
          const downloadedCounts: Record<string, { downloaded: number; total: number }> = {};

          for (const t of allTracks) {
              if (t.playlist == null) continue;
              if (!grouped[t.playlist]) grouped[t.playlist] = [];
              grouped[t.playlist].push(t.id);

              if (!downloadedCounts[t.playlist]) downloadedCounts[t.playlist] = { downloaded: 0, total: 0 };
              downloadedCounts[t.playlist].total += 1;
              if (t.downloaded) downloadedCounts[t.playlist].downloaded += 1;
          }

          setPlaylistTrackIds(grouped);
          // setPlaylistDownloadCounts(downloadedCounts);
      } catch (error) {
          console.error('Failed to load local playlists:', error);
      }
  };

  useFocusEffect(
      useCallback(() => {
          async function init() {
              const savedpath = await StorageUtil.GetFolder();
              if (savedpath) {
                  setFolder(savedpath);
              }
              await fetchPlaylists();
          }
          init();
      }, [])
  );

  const handleAdd = async () => {
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

      await Importplaylist(cleanPlaylistUrl, () => {});
      await fetchPlaylists();

      const targetPlaylist = await withDbLock(()=>db.query.playlists.findFirst({
        where: eq(playlists.url, cleanPlaylistUrl),
      }));

      setInputPlaylistUrl('');
      setModalVisible(false);
      setLoading(false);

      let resolveFailures = 0;
      let downloadFailures = 0;
      let downloadSuccesses = 0;

      if (targetPlaylist) {
        const pendingTracks = await withDbLock(()=>db
          .select()
          .from(tracks)
          .where(and(eq(tracks.playlist, targetPlaylist.id), eq(tracks.downloaded, false))));

        let resolvedCount = 0;
        const manifestResults = await mapWithConcurrency(pendingTracks, RESOLVE_CONCURRENCY, async (track) => {
          const result = await resolveTrackLink(track);
          resolvedCount++;
          return result;
        });



        const urlManifest = manifestResults.filter((item): item is ManifestItem => item !== null);
        resolveFailures = pendingTracks.length - urlManifest.length;

        if (urlManifest.length >= 0) {
          let completedCount = 0;
          const downloadResults = await mapWithConcurrency(urlManifest, DOWNLOAD_CONCURRENCY, async (item) => {
            const result = await downloadAndStore(item, activeFolder as string);
            completedCount++;
            return result;
          });

          downloadSuccesses = downloadResults.filter((r) => r.success).length;
          downloadFailures = downloadResults.filter((r) => !r.success).length;

          const result = await withDbLock(()=>db.select().from(tracks)); 
          setTracklist(result);
        }

        await fetchPlaylists();
      }


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
      if (!selectedpl) return;
      try {
          const del_queue = await withDbLock(()=>db.select().from(tracks).where(eq(tracks.playlist, selectedpl.id)))
          for (const track of del_queue) {
              await downloadStore.cancel(track.id);
              if (deltrackstoggle && track.filename) {
                  try {
                      await FileSystem.deleteAsync(track.filename);
                  } catch (e) {
                      console.log("Track deletion from filesystem error:", e);
                  }
              }
          }
          await withDbLock(()=>db.transaction(async (tx) => {
              if (deltrackstoggle) {
                  for (const track of del_queue) {
                      await tx.delete(tracks).where(eq(tracks.id, track.id));
                  }
              }
              await tx.delete(playlists).where(eq(playlists.id, selectedpl.id));
          }));
      } catch (e) {
          console.error("Playlist deletion error:", e);
          Alert.alert('Something went wrong', 'Could not fully delete the playlist.');
      } finally {
          await fetchPlaylists();
      }
  };

  return (
    <View className='pt-16 px-6 bg-background h-full font-poppins flex flex-col'>
      {/* Header */}
      <View className='mb-2'>
        <Text className='text-[31px] font-poppinsBold'>Localify</Text>
      </View>

      {activeDownloads.length > 0 && (
          <View className='text-[16px] w-full mb-8'>
              <View className='bg-black pr-[3px] pl-[2px] pt-[2px] pb-[3px] rounded-[5px]'>
                  <View className='bg-white rounded-[3px] p-3 gap-1'>
                      {activeDownloads.map((d) => {
                          const track = tracklist.find(t => t.id.toString() === d.trackId);
                          const pct = d.bytesTotal > 0 ? Math.round((d.bytesDownloaded / d.bytesTotal) * 100) : 0;
                          return (
                              <Text key={d.trackId} className='font-poppins text-[16px] text-black'>
                                  {track?.title ?? d.trackId} - {d.status} ({pct}%)
                              </Text>
                          );
                      })}
                  </View>
              </View>
          </View>
      )}

      <View className=''>
        <View className='w-full flex justify-between flex-row items-center'>
          <Text className='text-[25px] font-poppinsBold mb-2'>Synced playlists</Text>
          <Pressable onPress={()=>{fetchPlaylists()}} className='bg-green-500 aspect-square h-10'><Text className='w-full h-full text-center'>Rel</Text></Pressable>
        </View>
        <View className='gap-3 flex flex-col'>

          {allPlaylists.map((playlist) => (
              <Link
                  key={playlist.id}
                  href={{ pathname: './playlist/[id]', params: { id: playlist.id, title: playlist.name } }}
                  asChild
              >
                  <Pressable onLongPress={()=>{setplmenuVisible(true); setselectedpl(playlist)}}>
                      <PlaylistRow playlist={playlist} trackIds={playlistTrackIds[playlist.id] ?? []} />
                  </Pressable>
              </Link>
          ))}
          <Pressable onPress={() => { if (!loading) setModalVisible(true); }} className='w-full p-4 rounded-[6px] border-2 border-black/70 border-dashed flex-row items-center px-6 '>
            <View className='flex flex-row justify-between items-center w-full'>
              <Text className='text-[18px] font-poppinsMedium text-textColor/70  '>Add playlist</Text>
              <Text className='text-[21px] font-poppinsMedium  text-textColor/70'>+</Text>
            </View>
          </Pressable>
          <Link href={'./tracks/tracksp'}><Text>Helo</Text></Link>
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
                      <Pressable onPress={()=>{handleAdd()}} className='bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
                        {loading? (
                          <ActivityIndicator size={'large'} className='scale-[0.5]' />
                        )
                        :
                        <Text className='font-poppinsSemiBold text-[16px] mx-auto text-[#191414]'>
                          Add Playlist
                        </Text>
                      }

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