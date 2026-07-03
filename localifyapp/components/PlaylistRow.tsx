import Playlist from '@/components/Playlist';
import { usePlaylistDownloadStatus } from '@/hooks/usePlaylistDownloadStatus';

interface Playlist_ {
    id: number;
    name: string;
}

export default function PlaylistRow({ playlist, trackIds }: { playlist: Playlist_; trackIds: string[] }) {
    const { isAnyDownloading, activeCount } = usePlaylistDownloadStatus(trackIds);
    return <Playlist ID={playlist.id} isDownloading={isAnyDownloading} activeCount={activeCount} />;
}