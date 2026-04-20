// Default avatar helper. Produces a stable, unique DiceBear avatar per member
// using their member id so members without a Farcaster pfp still get a
// distinct default image.

export function defaultAvatarUrl(seed: string | number | undefined | null): string {
  const s = seed == null || seed === "" ? "anon" : String(seed);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s)}`;
}

export function resolveAvatarUrl(
  uploaded: string | null | undefined,
  farcasterPfp: string | null | undefined,
  seed: string | number | undefined | null,
): string {
  return uploaded || farcasterPfp || defaultAvatarUrl(seed);
}

// Resize an image file to a JPEG data URL that fits under MAX_BYTES.
// Steps quality down until the data URL string is small enough.
const MAX_SIDE = 256;
const MAX_BYTES = 250_000;

export async function resizeImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);

  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_BYTES) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}
