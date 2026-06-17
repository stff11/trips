// Prepares an image file for upload.
// Netlify function payload limit is 6 MB (base64-encoded, so effective ~4.5 MB raw).
// We target 3.5 MB to leave headroom for multipart overhead and base64 expansion.

const TARGET_BYTES = 3.5 * 1024 * 1024;

async function toBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

async function bitmapToJpegBlob(
  bitmap: ImageBitmap,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    ),
  );
}

async function compressToTarget(file: File): Promise<File> {
  const bitmap = await toBitmap(file);

  // Try progressively lower quality until we're under TARGET_BYTES.
  // Also scale down dimensions if quality alone isn't enough.
  const qualities = [0.85, 0.75, 0.65, 0.55];
  const scales = [1, 0.85, 0.7, 0.55];

  for (const scale of scales) {
    const scaledBitmap =
      scale < 1
        ? await createImageBitmap(file, {
            resizeWidth: Math.round(bitmap.width * scale),
            resizeHeight: Math.round(bitmap.height * scale),
            resizeQuality: 'high',
          })
        : bitmap;

    for (const quality of qualities) {
      const blob = await bitmapToJpegBlob(scaledBitmap, quality);
      if (blob.size <= TARGET_BYTES) {
        if (scale < 1) scaledBitmap.close();
        bitmap.close();
        const name = file.name.replace(/\.[^.]+$/, '.jpg');
        return new File([blob], name, { type: 'image/jpeg' });
      }
    }

    if (scale < 1) scaledBitmap.close();
  }

  // Last resort — lowest quality at half dimensions
  bitmap.close();
  const fallback = await createImageBitmap(file, {
    resizeWidth: Math.round(bitmap.width * 0.4),
    resizeHeight: Math.round(bitmap.height * 0.4),
    resizeQuality: 'high',
  });
  const blob = await bitmapToJpegBlob(fallback, 0.5);
  fallback.close();
  const name = file.name.replace(/\.[^.]+$/, '.jpg');
  return new File([blob], name, { type: 'image/jpeg' });
}

export async function prepareImageForUpload(file: File): Promise<File> {
  const isHeic =
    /\.(heic|heif)$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  // Always convert HEIC (server needs a standard image type)
  // Always compress if over target (stays under Netlify's 6 MB limit)
  if (isHeic || file.size > TARGET_BYTES) {
    return compressToTarget(file);
  }

  return file;
}
