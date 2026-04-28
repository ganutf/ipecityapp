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

// Resize an image file to a JPEG data URL that fits under maxBytes.
// Steps quality down until the data URL string is small enough.
const DEFAULT_MAX_SIDE = 256;
const DEFAULT_MAX_BYTES = 250_000;

export interface ResizeImageOptions {
  maxSide?: number;
  maxBytes?: number;
  /** "fit" preserves aspect ratio (default). "square" center-crops to a square of `maxSide`. */
  shape?: "fit" | "square";
}

export async function resizeImageToDataUrl(
  file: File,
  options: ResizeImageOptions = {},
): Promise<string> {
  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const shape = options.shape ?? "fit";

  const bitmap = await createImageBitmap(file);

  let canvasW: number;
  let canvasH: number;
  let drawArgs: [number, number, number, number, number, number, number, number];

  if (shape === "square") {
    const cropSide = Math.min(bitmap.width, bitmap.height);
    const sx = Math.round((bitmap.width - cropSide) / 2);
    const sy = Math.round((bitmap.height - cropSide) / 2);
    canvasW = canvasH = Math.min(maxSide, cropSide);
    drawArgs = [sx, sy, cropSide, cropSide, 0, 0, canvasW, canvasH];
  } else {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    canvasW = Math.round(bitmap.width * scale);
    canvasH = Math.round(bitmap.height * scale);
    drawArgs = [0, 0, bitmap.width, bitmap.height, 0, 0, canvasW, canvasH];
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, ...drawArgs);

  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxBytes) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}
