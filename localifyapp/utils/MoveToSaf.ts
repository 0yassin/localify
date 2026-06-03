import * as FileSystem from "expo-file-system/legacy";

export async function moveToSAF(
  sourceUri: string,
  folderUri: string,
  filename: string
) {
  const SAF = FileSystem.StorageAccessFramework;

  const targetUri = await SAF.createFileAsync(
    folderUri,
    filename,
    "audio/mpeg"
  );

  const fileInfo = await FileSystem.getInfoAsync(sourceUri);
  console.log(
    `Processing: ${filename} (${(
      ((fileInfo as any).size ?? 0) /
      1024 /
      1024
    ).toFixed(2)} MB)`
  );

  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await SAF.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await FileSystem.deleteAsync(sourceUri, {
    idempotent: true,
  });

  return targetUri;
}