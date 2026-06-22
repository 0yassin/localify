import Card from '@/components/Card';
import { db } from '@/db/client';
import { playlists, Track, tracks } from '@/db/schema';
import { Importplaylist } from '@/utils/Importplaylist';
import { moveToSAF } from '@/utils/MoveToSaf';
import { enqueueSAFWrite } from '@/utils/safque';
import { StorageUtil } from '@/utils/Storage';
import { createDownloadTask, directories } from '@kesha-antonov/react-native-background-downloader';
import { and, count, eq, type InferSelectModel } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Shadow } from 'react-native-shadow-2';


const RESOLVE_CONCURRENCY = 4;
const DOWNLOAD_CONCURRENCY = 3;

type BasePlaylistRow = InferSelectModel<typeof playlists>;
interface PlaylistWithCount extends BasePlaylistRow {
  trackCount: number;
}

type ManifestItem = { trackId: string; title: string; directUrl: string };
type DownloadResult = { success: boolean; title: string };

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

async function searchYoutube(query: string): Promise<string> {
  const searchurl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(searchurl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Youtube error: ${res.status}`);
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

    throw new Error('Target video could not be extracted from YouTube response.');
  } catch (err) {
    console.error('YouTube scraper exception:', err);
    throw new Error('Search execution failed');
  }
}

async function fetchAudio(url: string) {
    const API_URL = process.env.EXPO_PUBLIC_API_URL 
    return `${API_URL}/api/download?url=${encodeURIComponent(url)}`;
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

  return changed;
}


async function resolveTrackLink(track: Track): Promise<ManifestItem | null> {
  try {
    let ytUrl = track.ytlink;

    if (!ytUrl || ytUrl.length <= 1) {
      const vidID = await searchYoutube(`${track.title} - ${track.artist}`);
      ytUrl = `https://www.youtube.com/watch?v=${vidID}`;
      await db.update(tracks).set({ ytlink: ytUrl }).where(eq(tracks.id, track.id));
    }

    const directUrl = await fetchAudio(ytUrl);
    return { trackId: track.id, title: track.title, directUrl };
  } catch (err) {
    console.error(`Skipped track link generation for ${track.title}:`, err);
    return null;
  }
}


async function downloadAndStore(item: ManifestItem, activeFolder: string): Promise<DownloadResult> {
  return new Promise((resolve) => {
    const internalCachePath = `${directories.documents}/${item.trackId}.mp3`;
    const localSourceUri = `file://${internalCachePath}`;

    const task = createDownloadTask({
      id: item.trackId,
      url: item.directUrl,
      destination: internalCachePath,
    });

    task.begin(() => {});

    task.done(async () => {
      try {
        await enqueueSAFWrite(async () => {
          const finalUri = await moveToSAF(localSourceUri, activeFolder, `${item.title}-[${item.trackId}].mp3`);
          const fileInfo = await FileSystem.getInfoAsync(finalUri);

          if (!fileInfo.exists) {
            throw new Error(`Download failed for track ${item.title}`);
          }

          await db.update(tracks).set({ downloaded: true, filename: finalUri }).where(eq(tracks.id, item.trackId));

          try {
            await FileSystem.deleteAsync(internalCachePath, { idempotent: true });
          } catch {
          }
        });
        resolve({ success: true, title: item.title });
      } catch (e) {
        console.error(`Failed to finalize download for ${item.title}:`, e);
        resolve({ success: false, title: item.title });
      }
    });

    task.error((e: unknown) => {
      console.error(`Download task error for ${item.title}:`, e);
      resolve({ success: false, title: item.title });
    });

    task.start();
  });
}

export default function TabOneScreen() {
  const [inputPlaylistUrl, setInputPlaylistUrl] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Importing tracks from Spotify...');
  const [allPlaylists, setAllPlaylists] = useState<PlaylistWithCount[]>([]);
  const [folder, setFolder] = useState<string | null>(null);

  const RerenderPlaylists = async () => {
    const result = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        icon: playlists.icon,
        trackCount: count(tracks.id),
        url: playlists.url,
        lastChecked: playlists.lastChecked,
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

        if (urlManifest.length > 0) {
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
          <Text className='text-[25px] font-poppinsBold'>Synced playlists</Text>
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
              <Pressable>
                <Card Title={playlist.name} Details={`${playlist.trackCount} tracks`} ImagePath={playlist.icon || 'placeholder'} />
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
                      <Pressable onPress={handleAdd} className='bg-[#1DB954] border-2 text-[16px] font-poppinsMedium px-4 py-4 border-[#191414] rounded-[4px]'>
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

      </View>
    </View>
  );
}