import { prisma } from "./db.mjs";

const normalize = (value) => String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const hasPhrase = (text, phrase) => Boolean(phrase) && ` ${text} `.includes(` ${phrase} `);
const GENERIC_NAMES = new Set(["common entrance test", "entrance exam", "admission test", "board exam"]);
const UNTRUSTED_HOSTS = /(?:^|\.)(?:shiksha\.com|collegedunia\.com|collegedekho\.com|kollegeapply\.com|facebook\.com|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|t\.co)$/i;
const OFFICIAL_HOST = /(?:\.gov\.in|\.nic\.in|\.ac\.in|\.edu\.in)$/i;
const PUBLIC_HOST = /^(?=.{4,253}$)(?=.*\.[a-z]{2,}$)(?!.*\.\.)(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

export function matchExamRecord(topic, rows = []) {
  const title = normalize(typeof topic === "string" ? topic : topic?.title || topic?.headline || topic?.topic);
  const primary = normalize(typeof topic === "object" && topic !== null ? topic.primary_entity : "");
  if (!title && !primary) return null;
  const matches = rows.flatMap((row) => {
    const aliases = [row?.short_name, row?.name, row?.full_name].map(normalize)
      .filter((alias) => alias.length >= 3 && !GENERIC_NAMES.has(alias));
    const scores = aliases.filter((alias) => hasPhrase(primary, alias) || hasPhrase(title, alias))
      .map((alias) => (hasPhrase(primary, alias) ? 1_000 : 0) + alias.length + (row?.is_active ? 10 : 0));
    return scores.length ? [{ row, score: Math.max(...scores) }] : [];
  });
  matches.sort((left, right) => right.score - left.score);
  return matches[0]?.row || null;
}

export function candidateOfficialExamUrl(row) {
  try {
    const url = new URL(String(row?.official_website || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port || !PUBLIC_HOST.test(url.hostname) || UNTRUSTED_HOSTS.test(url.hostname)) return null;
    if (!OFFICIAL_HOST.test(url.hostname) && !row?.data_verified_at) return null;
    return url.href;
  } catch { return null; }
}

function sameTrustedDestination(source, destination) {
  try {
    const original = new URL(source).hostname.replace(/^www\./, "");
    const finalHost = new URL(destination).hostname.replace(/^www\./, "");
    return (original === finalHost || (OFFICIAL_HOST.test(finalHost) && (finalHost.endsWith(`.${original}`) || original.endsWith(`.${finalHost}`))))
      && new URL(destination).protocol === "https:";
  } catch { return false; }
}

export async function resolveExamLinkContext(topic, { client = prisma, fetchImpl = fetch } = {}) {
  const rows = await client.exams.findMany({
    select: { slug: true, name: true, short_name: true, full_name: true, official_website: true, data_verified_at: true, is_active: true },
    take: 1_500,
  });
  const exam = matchExamRecord(topic, rows);
  if (!exam) return { internalLinks: [], officialSignal: null };
  const label = String(exam.short_name || exam.name || "exam").trim().slice(0, 100);
  const slug = String(exam.slug || "");
  const internalLinks = exam.is_active && /^[a-z0-9][a-z0-9-]{1,180}$/.test(slug)
    ? [{ path: `/exams/${slug}`, label: `${label} exam guide` }]
    : [];
  const url = candidateOfficialExamUrl(exam);
  if (!url) return { internalLinks, officialSignal: null };
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "DekhoCampus editorial link verification/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    const finalUrl = response.url || url;
    await response.body?.cancel().catch(() => {});
    if (!response.ok || !sameTrustedDestination(url, finalUrl)) return { internalLinks, officialSignal: null };
    return {
      internalLinks,
      officialSignal: { name: `${label} official exam website`, url, source_type: "official", signal: `Verified live official website for ${label}. Use it for current notices and actions; this link check did not establish dates, fees or eligibility.` },
    };
  } catch {
    return { internalLinks, officialSignal: null };
  }
}

const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function insertVerifiedExamLinks(contentHtml, context = {}) {
  let html = String(contentHtml || "").trim();
  const link = context.internalLinks?.[0];
  const official = context.officialSignal;
  const parts = [];
  if (link && !html.includes(`href="${link.path}"`) && !html.includes(`href='${link.path}'`)) {
    const genericExamAnchor = /<a\b[^>]*href=["']\/exams["'][^>]*>[\s\S]*?<\/a>/i;
    const exactAnchor = `<a href="${link.path}">${escapeHtml(link.label)}</a>`;
    if (genericExamAnchor.test(html)) html = html.replace(genericExamAnchor, exactAnchor);
    else if ([...html.matchAll(/<a\b[^>]*href=["']\/(?!\/)/gi)].length < 4) {
      parts.push(`The ${exactAnchor} explains the wider exam process.`);
    }
  }
  if (official?.url && !html.includes(`href="${official.url}"`) && !html.includes(`href='${official.url}'`)
    && [...html.matchAll(/<a\b[^>]*href=["']https?:\/\//gi)].length < 4) {
    const label = String(official.name || "exam").replace(/ official exam website$/i, "");
    parts.push(`The exam authority's current notices are on the <a href="${official.url}" target="_blank" rel="noopener noreferrer">official ${escapeHtml(label)} website</a>.`);
  }
  if (!parts.length) return html;
  const paragraph = `<p>${parts.join(" ")}</p>`;
  return /<\/p>/i.test(html) ? html.replace(/<\/p>/i, `</p>${paragraph}`) : `${html}${paragraph}`;
}
