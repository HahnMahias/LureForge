/** Grabs a downscaled JPEG snapshot of the (first) WebGL canvas on the page. */
export function captureThumbnail(maxWidth = 320, maxHeight = 240): string {
  const source = document.querySelector('canvas');
  if (!source) return '';

  const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return '';

  try {
    ctx.drawImage(source, 0, 0, w, h);
    return out.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}
