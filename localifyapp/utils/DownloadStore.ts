
type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'done' | 'error';


type DownloadEntry = {
    task: any; 
    bytesDownloaded: number;
    bytesTotal: number;
    status: DownloadStatus;
};

let downloadMap: Record<string, DownloadEntry> = {}

const listeners = new Set<() => void>()
function emitChange(){
    listeners.forEach((l) => l())
}

export const downloadStore = {
    subscribe(listener:()=>void){
        listeners.add(listener)
        return () => listeners.delete(listener)
    },
    getSnapshot(){
        return downloadMap
    },
    register(id: string, task: any) {
        downloadMap = { ...downloadMap, [id]: { task, bytesDownloaded: 0, bytesTotal: 0, status: 'pending' } };
        emitChange();
    },
    updateProgress(id: string, bytesDownloaded: number, bytesTotal: number) {
        const existing = downloadMap[id];
        if (!existing) return;
        downloadMap = { ...downloadMap, [id]: { ...existing, bytesDownloaded, bytesTotal, status: 'downloading' } };
        emitChange();
    },

    setStatus(id: string, status: DownloadStatus) {
        const existing = downloadMap[id];
        if (!existing) return;
        downloadMap = { ...downloadMap, [id]: { ...existing, status } };
        emitChange();
    },
    remove(id: string) {
        const { [id]: _removed, ...rest } = downloadMap;
        downloadMap = rest;
        emitChange();
    },
    pause(id: string) {
        downloadMap[id]?.task.pause();
        this.setStatus(id, 'paused');
    },
    resume(id: string) {
        downloadMap[id]?.task.resume();
        this.setStatus(id, 'downloading');
    },
    cancel(id: string): Promise<void> {
        return new Promise((resolve) => {
            const entry = downloadMap[id];
            if (!entry) {
                resolve();
                return;
            }
            entry.task.error(() => {});
            entry.task.done(() => {}); 
            entry.task.stop();
            this.remove(id);
            resolve();
        });
    },
}