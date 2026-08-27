const PUBLIC_STORAGE_URL = /https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/[^\s"'<>]+/gi;

export function storageKeyFromPublicUrl(value) {
  try {
    const url = new URL(String(value));
    const match = decodeURIComponent(url.pathname).match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const key = `${match[1]}/${match[2]}`.replace(/^\/+/, "");
    return key.includes("..") ? null : key;
  } catch {
    return null;
  }
}

function publicUrl(mediaBaseUrl, key) {
  return `${mediaBaseUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function normalizeExternalStorageValue(value, { mediaBaseUrl, objectExists }) {
  const stats = { references: 0, normalized: 0, missing: 0 };

  const normalizeText = async (text) => {
    const exactKey = storageKeyFromPublicUrl(text);
    if (exactKey) {
      stats.references += 1;
      if (await objectExists(exactKey)) {
        stats.normalized += 1;
        return exactKey;
      }
      stats.missing += 1;
      return "";
    }

    const urls = [...text.matchAll(PUBLIC_STORAGE_URL)].map((match) => match[0]);
    let result = text;
    for (const url of [...new Set(urls)]) {
      const key = storageKeyFromPublicUrl(url);
      if (!key) continue;
      stats.references += 1;
      if (await objectExists(key)) {
        stats.normalized += 1;
        result = result.replaceAll(url, publicUrl(mediaBaseUrl, key));
      } else {
        stats.missing += 1;
        result = result.replaceAll(url, "");
      }
    }
    return result;
  };

  const visit = async (item) => {
    if (typeof item === "string") return normalizeText(item);
    if (Array.isArray(item)) return Promise.all(item.map(visit));
    if (item && typeof item === "object" && !(item instanceof Date)) {
      const entries = await Promise.all(Object.entries(item).map(async ([key, child]) => [key, await visit(child)]));
      return Object.fromEntries(entries);
    }
    return item;
  };

  return { value: await visit(value), stats };
}
