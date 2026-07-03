import { useDownloads } from '@/hooks/useDownloads';
import { useMemo } from 'react';

export function usePlaylistDownloadStatus(trackIds: string[]) {
    const downloads = useDownloads();

    return useMemo(() => {
        const idSet = new Set(trackIds);
        const activeEntries = Object.entries(downloads).filter(([id]) => idSet.has(id));

        return {
            isAnyDownloading: activeEntries.length > 0,
            activeCount: activeEntries.length,
        };
    }, [downloads, trackIds]);
}