import * as FileSystem from "expo-file-system/legacy";

export async function moveToSAF(
  sourceUri: string,
  folderUri: string,
  filename: string,
  existingUri?: string | null,
) {
  const SAF = FileSystem.StorageAccessFramework;

  if (existingUri){
    try {
      await SAF.deleteAsync(existingUri)
    } catch {}
  }


  const filexists = await waitForFile(sourceUri)
  if (!filexists) {
      throw new Error(`Source file missing before SAF move: ${sourceUri}`);
  }
  const sourceInfo = await FileSystem.getInfoAsync(sourceUri)
  const expectedSize = (sourceInfo as any).size ?? 0;

  console.log(`Processing: ${filename} (${(expectedSize / 1024 / 1024).toFixed(2)} MB)`);

  const targetUri = await SAF.createFileAsync(folderUri, filename, "audio/mpeg");

  try {
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {encoding: FileSystem.EncodingType.Base64});
      await SAF.writeAsStringAsync(targetUri, base64, {encoding: FileSystem.EncodingType.Base64});
      const targetInfo = await FileSystem.getInfoAsync(targetUri)
      const writtensize = (targetInfo as any).size ?? 0;

      if (!targetInfo.exists || expectedSize > 0 && writtensize === 0 ) throw new Error(`SAF write failed for ${filename}`)
      await FileSystem.deleteAsync(sourceUri, { idempotent: true });
      return targetUri
  } catch (e) {
    try {
      await SAF.deleteAsync(targetUri)
    } catch {}
    throw e
  }
}
async function waitForFile(uri: string, attempts = 15, delayMs = 1000): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
        const info = await FileSystem.getInfoAsync(uri);
        console.log(`[waitForFile] attempt ${i + 1}/${attempts}: exists=${info.exists} (${uri})`);
        if (info.exists) return true;
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}