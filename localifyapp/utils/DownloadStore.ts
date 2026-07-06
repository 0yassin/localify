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
    async pause(id: string) {
        const entry = downloadMap[id];
        if (!entry) return;
        try {
            await entry.task.pause();
            this.setStatus(id, 'paused');
        } catch (e) {
            console.error(`Failed to pause download ${id}:`, e);
        }
    },
    async resume(id: string) {
        const entry = downloadMap[id];
        if (!entry) return;
        const start = Date.now()
        console.log(`resume requested: for ${id} at ${start}`)
        try {
            await entry.task.resume();
            console.log(`[resume] task.resume() resolved for ${id} after ${Date.now() - start}ms`);          
            this.setStatus(id, 'downloading');
        } catch (e) {
            console.error(`Failed to resume download ${id}:`, e);      
        }
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