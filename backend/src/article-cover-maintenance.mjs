const RETIRED_ARTICLE_IMAGE_HOSTS = new Set(["cms.dekhocampus.com"]);

export function articleImageHost(value) {
  const image = String(value || "").trim();
  if (!image) return "(missing)";
  if (image.startsWith("/")) return "(local)";
  try {
    return new URL(image).hostname.toLowerCase();
  } catch {
    return "(invalid)";
  }
}

export function articleCoverRepairReason(value) {
  const image = String(value || "").trim();
  if (!image) return "missing";
  if (/\/(?:placeholder|image-placeholder)\.svg(?:$|[?#])/i.test(image)) return "placeholder";
  if (RETIRED_ARTICLE_IMAGE_HOSTS.has(articleImageHost(image))) return "retired-cms-host";
  return null;
}

export function articleCoverAudit(rows) {
  const hostCounts = {};
  const reasonCounts = {};
  const candidates = [];

  for (const row of rows) {
    const host = articleImageHost(row.featured_image);
    hostCounts[host] = (hostCounts[host] || 0) + 1;
    const reason = articleCoverRepairReason(row.featured_image);
    if (!reason) continue;
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    candidates.push({ ...row, repair_reason: reason });
  }

  return {
    candidates,
    hostCounts: Object.fromEntries(Object.entries(hostCounts).sort((a, b) => b[1] - a[1])),
    reasonCounts,
  };
}
