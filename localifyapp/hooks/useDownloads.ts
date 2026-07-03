// hooks/useDownloads.ts
import { downloadStore } from '@/utils/DownloadStore';
import { useSyncExternalStore } from 'react';

export function useDownloads() {
    return useSyncExternalStore(
        downloadStore.subscribe,
        downloadStore.getSnapshot,
        downloadStore.getSnapshot
    );
}