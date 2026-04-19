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
