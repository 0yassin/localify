import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { Refetchplaylists } from '@/utils/Refetchplaylists';
export const BACKGROUND_SYNC_TASK = 'localify-playlist-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        const result = await Refetchplaylists();
        console.log(`[background sync] changed=${result.changed}, downloaded=${result.downloadSuccesses}, failed=${result.downloadFailures}`);
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
        console.error('[background sync] failed:', error);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

export async function RegisterBackgroundSync(mininterval = 60) {
    const status = await BackgroundTask.getStatusAsync()
    if (status !== BackgroundTask.BackgroundTaskStatus.Available){
        console.log('Background tasks unavailable on this device');
        return;
    }
    const alreadyregistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)
    if (!alreadyregistered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: mininterval,
        })
    }
}