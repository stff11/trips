// Prepares an image file for upload:
//  - Converts HEIC/HEIF → JPEG using the browser's native image decoder
//    (Safari/Chrome on Apple silicon handle HEIC natively via createImageBitmap)
//  - Re-encodes any image larger than MAX_BYTES as JPEG to stay under the
//    Netlify CLI dev-server body-size limit (~4 MB)
//
// NOTE: canvas encoding strips EXIF. The server handles missing EXIF gracefully
// (no GPS → no location match; no date → null takenAt stored).

const MAX_BYTES = 3.5 * 1024 * 1024;
const JPEG_QUALITY = 0.88;

async function fileToJpegBlob(file: File, quality = JPEG_QUALITY): Promise<Blob> {
  // createImageBitmap handles HEIC on Safari 17+ and Chrome on macOS/iOS.
  // On browsers that don't support HEIC natively this will throw — caught below.
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
      'image/jpeg',
      quality,
    );
  });
}

function jpegName(original: string): string {
  return original.replace(/\.[^.]+$/, '.jpg');
}

export async function prepareImageForUpload(file: File): Promise<File> {
  const isHeic =
    /\.(heic|heif)$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';

  if (isHeic) {
    // Convert via canvas — works natively on Safari/Chrome macOS/iOS.
    // If the browser can't decode HEIC (e.g. Firefox on Linux) this throws
    // and the caller falls back to uploading the raw file.
    const blob = await fileToJpegBlob(file);
    return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
  }

  // For JPEG/PNG/WebP, only re-encode if the file exceeds the size cap.
  if (file.size <= MAX_BYTES) return file;

  // Scale down proportionally: halving linear dimensions quarters byte count.
  const scale = Math.min(1, Math.sqrt(MAX_BYTES / file.size));
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
}
