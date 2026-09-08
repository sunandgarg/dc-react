const EMBED_HOSTS = new Set([
  "www.google.com",
  "maps.google.com",
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeEmbedUrl(value: unknown): string | null {
  const safe = safeHttpUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return url.protocol === "https:" && EMBED_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : null;
}
