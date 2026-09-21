import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) args.set(key, true);
  else {
    args.set(key, value);
    index += 1;
  }
}

const sourcePath = resolve(String(args.get("--source") || "work/upgrad-sync/programs-before.json"));
const stateDir = resolve(String(args.get("--state-dir") || "work/upgrad-sync"));
const concurrency = Math.max(1, Math.min(8, Number(args.get("--concurrency") || 3)));
const refresh = args.has("--refresh");

await mkdir(join(stateDir, "html"), { recursive: true });
const programs = JSON.parse(await readFile(sourcePath, "utf8"));

function compact(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  if (!value) return "";
  return compact(new JSDOM(`<body>${value}</body>`, { virtualConsole: new VirtualConsole() }).window.document.body.textContent);
}

function originalImageUrl(value, baseUrl) {
  const raw = compact(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw, baseUrl);
    const nested = parsed.searchParams.get("url");
    return nested ? decodeURIComponent(nested) : parsed.href;
  } catch {
    return raw;
  }
}

function backgroundUrl(style, baseUrl) {
  const match = String(style || "").match(/background-image\s*:\s*url\((['"]?)(.*?)\1\)/i);
  return match ? originalImageUrl(match[2], baseUrl) : "";
}

function jsonLd(document) {
  const values = [];
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(node.textContent || "null");
      if (Array.isArray(parsed)) values.push(...parsed);
      else if (parsed) values.push(parsed);
    } catch {}
  }
  return values;
}

function findSchema(values, type) {
  return values.find((value) => {
    const declared = value?.["@type"];
    return Array.isArray(declared) ? declared.includes(type) : declared === type;
  });
}

function followingElements(start, selector, stopSelector = "h2", limit = 200) {
  const all = [...start.ownerDocument.querySelectorAll("*")];
  const index = all.indexOf(start);
  const matches = [];
  for (let offset = index + 1; offset < all.length && offset < index + limit; offset += 1) {
    const element = all[offset];
    if (element.matches(stopSelector)) break;
    if (element.matches(selector)) matches.push(element);
  }
  return matches;
}

function heading(document, pattern) {
  return [...document.querySelectorAll("h2,h3")].find((node) => pattern.test(compact(node.textContent)));
}

function sectionText(document, pattern, maxLength = 5000) {
  const title = heading(document, pattern);
  if (!title) return "";
  const parts = [];
  const all = [...document.querySelectorAll("h2,h3,p,li")];
  const index = all.indexOf(title);
  for (let offset = index + 1; offset < all.length; offset += 1) {
    const node = all[offset];
    if (node.tagName === "H2") break;
    const value = compact(node.textContent);
    if (!value || parts.includes(value)) continue;
    parts.push(value);
    if (parts.join(" ").length >= maxLength) break;
  }
  return compact(parts.join(" ")).slice(0, maxLength);
}

function firstImageAfterHeading(document, pattern) {
  const title = heading(document, pattern);
  if (!title) return "";
  const images = followingElements(title, "img", "h2", 350);
  for (const image of images) {
    const url = originalImageUrl(image.getAttribute("src"), document.URL);
    if (!url || /assets\.upgrad\.com\/.+\.(svg)(\?|$)/i.test(url)) continue;
    if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) return url;
  }
  return "";
}

function feeFromText(text) {
  const patterns = [
    /Totally\s+INR\s*([\d,]+)/i,
    /Total(?:ly)?\s+(?:course\s+)?fee\s*(?:is|of|:)??\s*(?:INR|₹|Rs\.?)*\s*([\d,]+)/i,
    /(?:Course|Programme|Program)\s+Fee\s*(?:is|of|:)??\s*(?:INR|₹|Rs\.?)*\s*([\d,]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ""));
  }
  return 0;
}

function emiFromText(text) {
  const match = text.match(/Starting at\s*(?:INR|₹|Rs\.?)*\s*([\d,]+)\s*\/\s*month/i)
    || text.match(/EMI(?:s)?\s+(?:start(?:s|ing)?\s+)?(?:at|from)?\s*(?:INR|₹|Rs\.?)*\s*([\d,]+)/i);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function heroDetails(document) {
  const h1 = document.querySelector("h1");
  if (!h1) return {};
  let hero = h1;
  let heroImage = "";
  for (let depth = 0; hero && depth < 12; depth += 1, hero = hero.parentElement) {
    heroImage ||= backgroundUrl(hero.getAttribute("style"), document.URL);
    if (heroImage) break;
  }
  if (!heroImage) {
    const heroImages = followingElements(h1, "img", "h2", 120).map((image) => ({
      url: originalImageUrl(image.getAttribute("src"), document.URL),
      alt: compact(image.getAttribute("alt")),
      cls: String(image.className || ""),
    }));
    const selected = heroImages.find((image) => /banner|hero|home section/i.test(`${image.alt} ${image.url}`)
      && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(image.url))
      || heroImages.find((image) => /object-cover|w-full.*h-full/i.test(image.cls)
        && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(image.url));
    heroImage = selected?.url || "";
  }
  hero = h1;
  for (let depth = 0; hero && depth < 7; depth += 1, hero = hero.parentElement) {
    if (compact(hero.textContent).length > 250 && hero.querySelectorAll("img").length > 0) break;
  }
  const logoCandidates = hero ? [...hero.querySelectorAll("img")] : [];
  const instituteLogo = logoCandidates
    .map((image) => ({
      url: originalImageUrl(image.getAttribute("src"), document.URL),
      cls: String(image.className || ""),
      alt: compact(image.getAttribute("alt")),
    }))
    .find((image) => image.url && /object-contain|logo|image/i.test(`${image.cls} ${image.alt}`)
      && !/border|education|alumni|star/i.test(image.url))?.url || "";
  const heroCopy = hero ? [...hero.querySelectorAll("p,li")]
    .map((node) => compact(node.textContent))
    .filter((value) => value.length >= 25 && value.length <= 320)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8) : [];
  return { hero_image_source: heroImage, institute_logo_source: instituteLogo, hero_copy: heroCopy };
}

function parsePage(program, html, finalUrl) {
  const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const dom = new JSDOM(markup, {
    url: finalUrl || program.apply_url,
    virtualConsole: new VirtualConsole(),
  });
  const { document } = dom.window;
  const schemas = jsonLd(document);
  const course = findSchema(schemas, "Course") || {};
  const faq = findSchema(schemas, "FAQPage") || {};
  const howTo = findSchema(schemas, "HowTo") || {};
  const bodyText = compact(document.body?.textContent);
  const credentialPrice = Number(course?.educationalCredentialAwarded?.offers?.price || 0);
  const visiblePrice = feeFromText(bodyText);
  const courseInstance = Array.isArray(course.hasCourseInstance) ? course.hasCourseInstance[0] : course.hasCourseInstance;
  const faqRows = Array.isArray(faq.mainEntity) ? faq.mainEntity.map((item) => ({
    q: compact(item.name),
    a: stripHtml(item.acceptedAnswer?.text),
  })).filter((item) => item.q && item.a) : [];
  const steps = Array.isArray(howTo.step) ? howTo.step.map((item) => ({
    title: compact(item.name),
    desc: stripHtml(item.text),
  })).filter((item) => item.title) : [];
  const ratingMatch = bodyText.match(/(\d(?:\.\d)?)\s*\/\s*5\s*\(([\d,]+)\s+ratings?\)/i);
  const learnersMatch = bodyText.match(/Join\s+([\d,.]+[kKmM]?\+?)\s+alumni/i);
  const hero = heroDetails(document);
  const certImage = firstImageAfterHeading(document, /certification|certificate/i);
  const about = sectionText(document, /^What is\b/i, 6000);
  const eligibility = sectionText(document, /\bEligibility\b/i, 3000);

  return {
    id: program.id,
    slug: program.slug,
    apply_url: program.apply_url,
    final_url: finalUrl || program.apply_url,
    http_title: compact(document.title),
    source_title: compact(course.name || document.querySelector("h1")?.textContent),
    source_description: compact(course.description || document.querySelector('meta[name="description"]')?.content),
    source_price: visiblePrice >= 1_000 ? visiblePrice : credentialPrice,
    source_emi: emiFromText(bodyText),
    source_start_date: compact(courseInstance?.courseSchedule?.startDate),
    source_end_date: compact(courseInstance?.courseSchedule?.endDate),
    source_mode: compact(courseInstance?.courseMode),
    source_faqs: faqRows,
    source_application_steps: steps,
    source_certificate_image: certImage,
    source_about: about,
    source_eligibility: eligibility,
    source_rating: ratingMatch ? Number(ratingMatch[1]) : 0,
    source_rating_count: ratingMatch ? Number(ratingMatch[2].replace(/,/g, "")) : 0,
    source_learners: learnersMatch ? learnersMatch[1] : "",
    ...hero,
  };
}

async function fetchWithRetry(url, attempts = 3) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-IN,en;q=0.9",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { html: await response.text(), finalUrl: response.url, status: response.status };
    } catch (caught) {
      error = caught;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * attempt));
    }
  }
  throw error;
}

async function audit(program, index) {
  const cachePath = join(stateDir, "html", `${program.slug}.html`);
  try {
    let html;
    let finalUrl = program.apply_url;
    if (!refresh && existsSync(cachePath)) html = await readFile(cachePath, "utf8");
    else {
      const fetched = await fetchWithRetry(program.apply_url);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
      await writeFile(cachePath, html, "utf8");
    }
    const parsed = parsePage(program, html, finalUrl);
    process.stdout.write(`[${index + 1}/${programs.length}] OK ${program.slug}\n`);
    return { ok: true, ...parsed };
  } catch (error) {
    process.stdout.write(`[${index + 1}/${programs.length}] FAIL ${program.slug}: ${error.message}\n`);
    return { ok: false, id: program.id, slug: program.slug, apply_url: program.apply_url, error: error.message };
  }
}

const results = new Array(programs.length);
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < programs.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await audit(programs[index], index);
  }
}));

await writeFile(join(stateDir, "upgrad-audit.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
const summary = {
  total: results.length,
  succeeded: results.filter((row) => row.ok).length,
  failed: results.filter((row) => !row.ok).length,
  hero_images: results.filter((row) => row.hero_image_source).length,
  certificate_images: results.filter((row) => row.source_certificate_image).length,
  explicit_prices: results.filter((row) => row.source_price > 0).length,
  explicit_emi: results.filter((row) => row.source_emi > 0).length,
  source_faqs: results.filter((row) => row.source_faqs?.length).length,
  application_steps: results.filter((row) => row.source_application_steps?.length).length,
  start_dates: results.filter((row) => row.source_start_date).length,
};
await writeFile(join(stateDir, "audit-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
