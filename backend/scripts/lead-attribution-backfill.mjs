export function attributionFromPageUrl(pageUrl) {
  if (!pageUrl) return {};
  try {
    const params = new URL(pageUrl, "https://dekhocampus.com").searchParams;
    const attribution = {};
    for (const [key, value] of params) {
      const field = key.toLowerCase();
      if (["utm_source", "utm_medium", "utm_campaign"].includes(field) && value.trim()) {
        attribution[field] = value.trim().slice(0, 160);
      }
    }
    return attribution;
  } catch {
    return {};
  }
}
