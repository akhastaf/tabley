/**
 * Resize an image File to a JPEG dataURL that fits within `maxSize` pixels on
 * the longest side, preserving aspect ratio. Used for menu-item photos where
 * a rectangular shape matters and we want to keep payloads under ~2 MB.
 */
export async function fileToFittedJpegDataUrl(
  file: File,
  maxSize = 1024,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('Failed to read file'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to decode image'));
    i.src = dataUrl;
  });
  const { naturalWidth: w, naturalHeight: h } = img;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  ctx.drawImage(img, 0, 0, tw, th);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Resize an image File to a square dataURL of at most `maxSize` pixels per side,
 * encoded as JPEG. Used for avatar uploads — keeps the payload small enough to
 * inline in the user row.
 */
export async function fileToSquareJpegDataUrl(
  file: File,
  maxSize = 256,
  quality = 0.85,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('Failed to read file'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to decode image'));
    i.src = dataUrl;
  });

  const { naturalWidth: w, naturalHeight: h } = img;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = maxSize;
  canvas.height = maxSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
  return canvas.toDataURL('image/jpeg', quality);
}
