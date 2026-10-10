const SITE_URL = "https://dekhocampus.com";

const PRIVATE_PREFIXES = [
  "/admin", "/auth", "/dashboard", "/onboarding", "/target-dashboard",
  "/my-targets", "/target-with-ai", "/s/", "/r/", "/lp",
];

const PUBLIC_ROOTS = [
  "/colleges", "/courses", "/exams", "/premium-programs", "/news", "/careers",
  "/jobs", "/vacancies", "/scholarships", "/study-material", "/college-study-material",
  "/resources", "/tools", "/cat-universe", "/compare", "/eligibility-checker",
  "/college-predictor", "/exam-calendar", "/exam-calendar-2026", "/lock-target",
  "/achieve-target", "/roadmap", "/dream-college-roadmap", "/about-us", "/about",
  "/landing", "/author", "/legal",
];

const LISTING_QUERY_KEYS = {
  "/colleges": new Set(["stream", "group", "type", "approval", "naac", "fee", "exam", "state", "city"]),
  "/courses": new Set(["stream", "group", "specialization", "mode", "duration"]),
  "/exams": new Set(["category", "stream", "group", "level"]),
};

const STATIC_METADATA = new Map([
  ["/cat-universe/cat-2026-preparation-kit", {
    title: "Free CAT 2026 Preparation Kit, Papers and AI Coach | DekhoCampus",
    description: "Download a free CAT 2026 preparation kit with actual papers, solutions, practice banks, short methods and a practical preparation roadmap.",
  }],
  ["/cat-universe/ai-interview-practice", {
    title: "Free AI IIM Interview Practice for CAT 2026 | DekhoCampus",
    description: "Practise IIM and MBA interview questions and improve clarity, structure, relevance, evidence and confidence with immediate guided feedback.",
  }],
  ["/cat-universe/ai-coach", {
    title: "Free AI CAT Coach and Study Planner 2026 | DekhoCampus",
    description: "Build a practical CAT study plan from your target percentile, available time and weakest section, then track daily and weekly checkpoints.",
  }],
]);

const ACRONYMS = new Map([
  ["ai", "AI"], ["aicte", "AICTE"], ["ba", "BA"], ["bba", "BBA"], ["bca", "BCA"],
  ["bcom", "B.Com"], ["btech", "B.Tech"], ["cat", "CAT"], ["cbse", "CBSE"],
  ["cuet", "CUET"], ["gate", "GATE"], ["iit", "IIT"], ["jee", "JEE"], ["llb", "LLB"],
  ["lpu", "LPU"], ["ma", "MA"], ["mba", "MBA"], ["mbbs", "MBBS"], ["mca", "MCA"],
  ["mcom", "M.Com"], ["mtech", "M.Tech"], ["naac", "NAAC"], ["neet", "NEET"],
  ["ncr", "NCR"], ["nit", "NIT"], ["pg", "PG"], ["phd", "Ph.D"], ["ug", "UG"],
  ["ugc", "UGC"], ["upsc", "UPSC"],
]);

function cleanPath(pathname) {
  const value = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return value || "/";
}

function titleCase(value) {
  return String(value || "")
    .replace(/-(?:\d{5,})$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => ACRONYMS.get(word.toLowerCase()) || `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function queryValue(url, key) {
  return titleCase(url.searchParams.get(key) || "");
}

function listingMetadata(url, pathname) {
  if (pathname === "/colleges") {
    const subject = queryValue(url, "group") || queryValue(url, "stream") || queryValue(url, "type") || queryValue(url, "approval") || "Top";
    const place = queryValue(url, "city") || queryValue(url, "state") || "India";
    const title = `${subject} Colleges in ${place} 2027 - Fees, Admissions & Rankings | DekhoCampus`;
    return { title, description: `Explore ${subject.toLowerCase()} colleges in ${place}. Compare fees, courses, placements, rankings and 2027 admission details.` };
  }
  if (pathname === "/courses") {
    const subject = queryValue(url, "group") || queryValue(url, "specialization") || queryValue(url, "stream") || "Top Courses";
    const mode = queryValue(url, "mode");
    const title = `${subject}${mode ? ` ${mode}` : ""} 2027 - Eligibility, Fees & Colleges | DekhoCampus`;
    return { title, description: `Explore ${subject} courses${mode ? ` in ${mode} mode` : ""}. Compare eligibility, duration, fees, specializations and top colleges.` };
  }
  const subject = queryValue(url, "group") || queryValue(url, "stream") || queryValue(url, "category") || "Entrance Exams";
  const level = queryValue(url, "level");
  const title = `${subject}${level ? ` ${level}` : ""} Exams 2027 - Dates, Eligibility & Syllabus | DekhoCampus`;
  return { title, description: `Explore ${subject} exams${level ? ` for ${level} level` : ""}, including 2027 dates, eligibility, applications, syllabus and preparation resources.` };
}

function detailMetadata(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0] || "";
  const labels = {
    colleges: "College", courses: "Course", exams: "Exam", news: "Education News",
    careers: "Career", jobs: "Job", vacancies: "Vacancy", scholarships: "Scholarship",
    "premium-programs": "Program", author: "Author", legal: "DekhoCampus",
  };
  const raw = root === "news" && segments[1] === "tag" ? segments[2] : segments[1];
  const name = titleCase(decodeURIComponent(raw || root));
  const section = labels[root] || "DekhoCampus";
  const tab = segments.length > 2 && !(root === "news" && segments[1] === "tag") ? titleCase(segments.at(-1)) : "";
  const title = `${name}${tab ? ` - ${tab}` : ""} | ${section} | DekhoCampus`;
  return { title, description: `Read verified ${section.toLowerCase()} information about ${name}, including the latest details available on DekhoCampus.` };
}

function isPublicPath(pathname) {
  return pathname === "/" || PUBLIC_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function isIndexableQuery(url, pathname) {
  if (!url.search) return true;
  if (pathname === "/news") {
    const keys = [...url.searchParams.keys()];
    const page = url.searchParams.get("page") || "";
    return keys.length === 1 && keys[0] === "page" && /^(?:[2-9]|[1-9]\d{1,2})$/.test(page);
  }
  const allowed = LISTING_QUERY_KEYS[pathname];
  if (!allowed) return false;
  const keys = [...url.searchParams.keys()];
  return keys.length > 0 && keys.every((key) => allowed.has(key)) && [...url.searchParams.values()].every((value) => value.trim());
}

export function edgeSeoFor(input) {
  const url = input instanceof URL ? input : new URL(input);
  const pathname = cleanPath(url.pathname);
  const privatePath = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const publicPath = isPublicPath(pathname);
  const indexable = !privatePath && publicPath && isIndexableQuery(url, pathname);
  const fullPageAlias = pathname.match(/^\/(colleges|courses)\/([^/]+)\/[^/]+$/);
  const canonicalBase = fullPageAlias ? `/${fullPageAlias[1]}/${fullPageAlias[2]}` : pathname;
  const canonicalPath = indexable && url.search ? `${canonicalBase}${url.search}` : canonicalBase;
  const canonical = `${SITE_URL}${canonicalPath === "/" ? "" : canonicalPath}`;

  if (pathname === "/") {
    return {
      canonical: SITE_URL,
      description: "Explore colleges, courses, entrance exams, scholarships and education news with DekhoCampus.",
      indexable: true,
      title: "DekhoCampus - Find Your College, Course & Career",
    };
  }

  const metadata = pathname === "/news"
    ? {
      title: `Latest Education News${url.searchParams.has("page") ? ` - Page ${url.searchParams.get("page")}` : ""} | DekhoCampus`,
      description: "Read the latest verified exam, admission, college and education updates for students in India.",
    }
    : STATIC_METADATA.get(pathname) || (LISTING_QUERY_KEYS[pathname] ? listingMetadata(url, pathname) : detailMetadata(pathname));
  return { ...metadata, canonical, indexable, notFound: !privatePath && !publicPath };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function newsListingEdgeSeo(articles, url, page = 1, hasNextPage = false) {
  const metadata = edgeSeoFor(url);
  const items = articles
    .filter((article) => article?.slug && article?.title)
    .map((article) => `<li><a href="/news/${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></li>`)
    .join("");
  const previous = page > 1 ? `<a href="${page === 2 ? "/news" : `/news?page=${page - 1}`}">Newer articles</a>` : "";
  const next = hasNextPage ? `<a href="/news?page=${page + 1}">Older articles</a>` : "";
  return {
    ...metadata,
    prerenderHtml: `<main data-dc-edge-prerender style="max-width:1000px;margin:32px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.6;color:#111827"><h1>Latest education news${page > 1 ? ` - Page ${page}` : ""}</h1><p>Exam, admission and college updates for students in India.</p><ul>${items}</ul><nav aria-label="News pages">${previous}${previous && next ? " | " : ""}${next}</nav></main>`,
  };
}

function replaceOrInsert(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
}

function articlePlainText(value) {
  return String(value || "")
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLE_TAGS = new Set("h1 h2 h3 h4 h5 h6 p br hr span div section article strong b em i u s sub sup mark small ul ol li blockquote q cite a figure figcaption img table thead tbody tfoot tr th td caption colgroup col code pre kbd samp var".split(" "));
const ARTICLE_VOID_TAGS = new Set(["br", "hr", "img", "col"]);
const ARTICLE_BLOCKED_TAGS = new Set(["script", "style", "iframe", "object", "embed", "form", "svg", "math", "template", "textarea", "title", "noscript"]);

function decodeArticleAttribute(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", colon: ":", tab: "\t", newline: "\n" };
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|colon|tab|newline);/gi, (entity, name) => {
    if (name[0] !== "#") return named[name.toLowerCase()];
    const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function articleSafeUrl(value) {
  try {
    const decoded = decodeArticleAttribute(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!decoded) return "";
    const parsed = new URL(decoded, SITE_URL);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return "";
    return decoded.startsWith("#") ? decoded : parsed.href;
  } catch { return ""; }
}

function articlePrerenderBlocks(value) {
  // Rebuild allowlisted markup; Workers have no DOMParser and cannot trust authored attributes.
  let source = String(value || "");
  // Some older CMS imports encoded the complete HTML fragment more than once.
  for (let pass = 0; pass < 3 && /&(?:amp;)?(?:lt|#0*60|#x0*3c);/i.test(source); pass += 1) {
    source = decodeArticleAttribute(source);
  }
  source = source.replace(/<[^>]+>/g, (tag) => tag.replace(/\\+(["'])/g, "$1"));
  const tokens = /<!--[\s\S]*?(?:-->|$)|<\/?[a-z][\w:-]*(?:[^<>"']|"[^"]*"|'[^']*')*>/gi;
  const text = (part) => escapeHtml(part).replace(/&amp;((?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);)/gi, "&$1");
  const output = [];
  const stack = [];
  const citationIds = new Set();
  let blocked = "";
  let last = 0;
  let token;
  while ((token = tokens.exec(source))) {
    if (!blocked) output.push(text(source.slice(last, token.index)));
    last = tokens.lastIndex;
    const match = token[0].match(/^<(\/)?([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!match) continue;
    const [, closing, rawTag, rawAttributes] = match;
    const name = rawTag.toLowerCase();
    if (blocked) {
      if (closing && name === blocked) blocked = "";
      continue;
    }
    if (ARTICLE_BLOCKED_TAGS.has(name)) {
      if (!closing && !/\/\s*>$/.test(token[0]) && !["embed"].includes(name)) blocked = name;
      continue;
    }
    if (!ARTICLE_TAGS.has(name)) continue;
    const tag = name === "h1" ? "h2" : name;
    if (closing) {
      const index = stack.lastIndexOf(tag);
      if (index !== -1) while (stack.length > index) output.push(`</${stack.pop()}>`);
      continue;
    }
    const attributes = new Map();
    const attributePattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attribute;
    while ((attribute = attributePattern.exec(rawAttributes))) {
      const key = attribute[1].toLowerCase();
      if (!attributes.has(key)) attributes.set(key, attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
    }
    let safeAttributes = "";
    const add = (key, val) => { safeAttributes += ` ${key}="${escapeHtml(val)}"`; };
    if (attributes.has("title")) add("title", decodeArticleAttribute(attributes.get("title")).slice(0, 200));
    if (tag === "a" && attributes.has("href")) {
      const href = articleSafeUrl(attributes.get("href"));
      if (href) { add("href", href); add("rel", "noopener noreferrer"); }
    }
    if (tag === "img") {
      const src = articleSafeUrl(attributes.get("src") || "");
      if (!src) continue;
      add("src", src); add("alt", decodeArticleAttribute(attributes.get("alt") || ""));
      add("loading", "lazy"); add("decoding", "async");
    }
    for (const key of ["colspan", "rowspan", "width", "height", "start"]) {
      const val = attributes.get(key) || "";
      if (/^\d{1,4}$/.test(val) && (Number(val) > 0 || key === "rowspan")) add(key, val);
    }
    if (["row", "col", "rowgroup", "colgroup"].includes(attributes.get("scope"))) add("scope", attributes.get("scope"));
    const id = decodeArticleAttribute(attributes.get("id") || "");
    // Namespace citation targets so authored IDs cannot clobber application IDs.
    if (/^[a-z][a-z\d_.:-]{0,199}$/i.test(id)) {
      add("id", `dc-article-${id}`);
      citationIds.add(id);
    }
    output.push(`<${tag}${safeAttributes}>`);
    if (!ARTICLE_VOID_TAGS.has(tag)) stack.push(tag);
  }
  if (!blocked) output.push(text(source.slice(last)));
  while (stack.length) output.push(`</${stack.pop()}>`);
  return output.join("").trim().replace(/ href="#([^"<>]*)"/g, (attribute, fragment) => {
    try {
      const id = decodeURIComponent(fragment);
      return citationIds.has(id) ? ` href="#dc-article-${id}"` : attribute;
    } catch { return attribute; }
  });
}

function addCbseSamplePaperLinks(title, content) {
  if (!/CBSE Sample Papers 2027/i.test(String(title || "")) || /SQP_CLASSX(?:II)?_2026-27\.html/i.test(String(content || ""))) return content;
  const links = '<p>Download the official <a href="https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html">CBSE Class 10 sample papers and marking schemes</a> or the <a href="https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html">CBSE Class 12 sample papers and marking schemes</a>. Choose your subject on the CBSE page.</p>';
  const heading = /(<h[2-4]\b[^>]*>\s*Click here to Download SQPs\s*<\/h[2-4]>)/i;
  return heading.test(content) ? content.replace(heading, `$1${links}`) : `${links}${content}`;
}

function absoluteMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, SITE_URL);
    if (url.pathname.startsWith("/storage/v1/object/public/")) {
      return `${SITE_URL}${url.pathname}${url.search}`;
    }
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function youtubeEmbedUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    let videoId = "";
    if (url.hostname === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([^/?#]+)/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
}

const ENTITY_SEO = {
  colleges: {
    label: "College",
    schemaType: "CollegeOrUniversity",
    imageAlt: (name) => `${name} campus`,
    fallbackTitle: (name) => `${name} 2027: Courses, Fees, Admissions & Placements`,
  },
  courses: {
    label: "Course",
    schemaType: "Course",
    imageAlt: (name) => `${name} course guide`,
    fallbackTitle: (name) => `${name} 2027: Eligibility, Fees, Syllabus & Colleges`,
  },
  exams: {
    label: "Exam",
    schemaType: "LearningResource",
    imageAlt: (name) => `${name} exam guide`,
    fallbackTitle: (name) => `${name} 2027: Dates, Eligibility, Syllabus & Updates`,
  },
};

export function entityEdgeSeo(entity, url, entityType) {
  const config = ENTITY_SEO[entityType];
  if (!config) return edgeSeoFor(url);
  const segments = cleanPath(url.pathname).split("/").filter(Boolean);
  // College/course section routes display the same full entity page, not separate content.
  const fullPageEntity = entityType === "colleges" || entityType === "courses";
  const canonicalSlug = entity.slug ? `${entity.slug}${entity.short_id ? `-${entity.short_id}` : ""}` : segments[1];
  const canonical = `${SITE_URL}${fullPageEntity ? `/${entityType}/${canonicalSlug}` : cleanPath(url.pathname)}`;
  const tab = segments.length > 2 ? titleCase(segments.at(-1)) : "";
  const name = String(entity.name || entity.full_name || titleCase(segments[1])).trim();
  const rawTitle = articlePlainText(entity.meta_title) || config.fallbackTitle(name);
  const titleWithTab = tab ? `${name} ${tab}` : rawTitle;
  const title = titleWithTab.includes("DekhoCampus") ? titleWithTab : `${titleWithTab} | DekhoCampus`;
  const description = articlePlainText(entity.page_summary || entity.meta_description || entity.description)
    || `Explore verified ${config.label.toLowerCase()} information for ${name} on DekhoCampus.`;
  const image = absoluteMediaUrl(entity.image || entity.logo);
  const imageAlt = config.imageAlt(name);
  const modifiedAt = entity.updated_at;
  const videoEmbedUrl = youtubeEmbedUrl(entity.youtube_video_url);
  const imageObject = image ? {
    "@type": "ImageObject",
    "@id": `${canonical}#primaryimage`,
    url: image,
    contentUrl: image,
    caption: imageAlt,
  } : null;
  const entitySchema = {
    "@type": config.schemaType,
    "@id": `${canonical}#entity`,
    name,
    url: canonical,
    description,
    ...(image ? { image: { "@id": `${canonical}#primaryimage` } } : {}),
    ...(entityType === "colleges" && (entity.city || entity.state) ? {
      address: {
        "@type": "PostalAddress",
        ...(entity.city ? { addressLocality: String(entity.city) } : {}),
        ...(entity.state ? { addressRegion: String(entity.state) } : {}),
        addressCountry: "IN",
      },
    } : {}),
    ...(entityType === "courses" ? {
      provider: { "@id": `${SITE_URL}/#organization` },
    } : {}),
  };
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: `${config.label}s`, item: `${SITE_URL}/${entityType}` },
    { "@type": "ListItem", position: 3, name, item: fullPageEntity ? canonical : `${SITE_URL}/${entityType}/${segments[1]}` },
  ];
  if (tab && !fullPageEntity) breadcrumbItems.push({ "@type": "ListItem", position: 4, name: tab, item: canonical });

  return {
    canonical,
    description,
    image,
    imageAlt,
    indexable: true,
    title,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "DekhoCampus",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
        },
        ...(imageObject ? [imageObject] : []),
        ...(videoEmbedUrl && image && modifiedAt ? [{
          "@type": "VideoObject",
          "@id": `${canonical}#video`,
          name: `${name} video guide`,
          description,
          thumbnailUrl: [image],
          uploadDate: modifiedAt,
          embedUrl: videoEmbedUrl,
        }] : []),
        entitySchema,
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name,
          description,
          mainEntity: { "@id": `${canonical}#entity` },
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
          ...(image ? { primaryImageOfPage: { "@id": `${canonical}#primaryimage` } } : {}),
          ...(modifiedAt ? { dateModified: modifiedAt } : {}),
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonical}#breadcrumb`,
          itemListElement: breadcrumbItems,
        },
      ],
    },
    prerenderHtml: `<article data-dc-edge-prerender style="max-width:1180px;margin:24px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.6;color:#111827">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" width="1200" height="675" style="display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover" loading="eager" fetchpriority="high" decoding="async">` : ""}<h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p></article>`,
  };
}

export function articleEdgeSeo(article, url) {
  const canonical = `${SITE_URL}${cleanPath(url.pathname)}`;
  const title = String(article.meta_title || article.title || "Education News").trim();
  const description = articlePlainText(article.meta_description || article.description || "");
  const image = absoluteMediaUrl(article.featured_image);
  const imageAlt = String(article.title || title);
  const publishedAt = article.published_at || article.created_at;
  const modifiedAt = article.updated_at || publishedAt;
  const authorName = String(article.resolved_author?.name || article.author || "DekhoCampus Editorial");
  const authorSlug = String(article.resolved_author?.slug || "");
  const authorIsOrganization = /dekhocampus/i.test(authorName);
  const author = { "@type": authorIsOrganization ? "Organization" : "Person", name: authorName, ...(authorSlug ? { url: `${SITE_URL}/author/${encodeURIComponent(authorSlug)}` } : authorIsOrganization ? { url: `${SITE_URL}/about-us` } : {}) };
  const publicationLabel = publishedAt && Number.isFinite(new Date(publishedAt).getTime())
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(publishedAt))
    : "";
  return {
    canonical,
    description,
    image,
    imageAlt,
    indexable: true,
    title: title.includes("DekhoCampus") ? title : `${title} | DekhoCampus`,
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: "DekhoCampus",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: String(article.title || title),
          description,
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
          ...(image ? { primaryImageOfPage: { "@type": "ImageObject", url: image, contentUrl: image, caption: imageAlt } } : {}),
          ...(publishedAt ? { datePublished: publishedAt } : {}),
          ...(modifiedAt ? { dateModified: modifiedAt } : {}),
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${canonical}#breadcrumb`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "News", item: `${SITE_URL}/news` },
            { "@type": "ListItem", position: 3, name: String(article.title || title), item: canonical },
          ],
        },
        {
          "@type": "NewsArticle",
          "@id": `${canonical}#article`,
          headline: String(article.title || title),
          description,
          ...(image ? { image: [image] } : {}),
          ...(publishedAt ? { datePublished: publishedAt } : {}),
          ...(modifiedAt ? { dateModified: modifiedAt } : {}),
          author,
          publisher: { "@id": `${SITE_URL}/#organization` },
          mainEntityOfPage: { "@id": `${canonical}#webpage` },
        },
      ],
    },
    prerenderHtml: `<article data-dc-edge-prerender style="max-width:860px;margin:32px auto;padding:0 20px;font-family:var(--font-site,sans-serif);line-height:1.65;color:#111827">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" width="1200" height="675" style="display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover" loading="eager" fetchpriority="high" decoding="async">` : ""}<h1>${escapeHtml(article.title || title)}</h1><p>By ${authorSlug ? `<a href="/author/${encodeURIComponent(authorSlug)}">${escapeHtml(authorName)}</a>` : escapeHtml(authorName)}${publicationLabel ? ` · <time datetime="${escapeHtml(publishedAt)}">${escapeHtml(publicationLabel)} IST</time>` : ""}</p>${description ? `<p>${escapeHtml(description)}</p>` : ""}${articlePrerenderBlocks(addCbseSamplePaperLinks(article.title, article.content))}</article>`,
  };
}

export function applyEdgeSeo(html, metadata) {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = escapeHtml(metadata.canonical);
  const robots = metadata.indexable
    ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    : "noindex, follow, noarchive";

  let output = replaceOrInsert(html, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  output = replaceOrInsert(output, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}">`);
  output = replaceOrInsert(output, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}">`);
  output = replaceOrInsert(output, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`);
  output = replaceOrInsert(output, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}">`);
  output = replaceOrInsert(output, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}">`);
  output = replaceOrInsert(output, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonical}">`);
  output = replaceOrInsert(output, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${title}">`);
  output = replaceOrInsert(output, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${description}">`);
  output = replaceOrInsert(output, /<meta\s+name=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${canonical}">`);
  if (metadata.image) {
    const image = escapeHtml(metadata.image);
    const imageAlt = escapeHtml(metadata.imageAlt || metadata.title);
    output = replaceOrInsert(output, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${image}">`);
    output = replaceOrInsert(output, /<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${imageAlt}">`);
    output = replaceOrInsert(output, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${image}">`);
    output = replaceOrInsert(output, /<meta\s+name=["']twitter:image:alt["'][^>]*>/i, `<meta name="twitter:image:alt" content="${imageAlt}">`);
  }
  if (metadata.structuredData) {
    const json = JSON.stringify(metadata.structuredData).replace(/</g, "\\u003c");
    output = output.replace(/<\/head>/i, `    <script type="application/ld+json" data-dc-edge-schema>${json}</script>\n  </head>`);
  }
  if (metadata.prerenderHtml) {
    // The static first-paint shell belongs to the homepage, not to article or archive HTML.
    output = output.replace(/<div id="dc-first-paint-shell" hidden>[\s\S]*?<\/main>\s*<\/div>/i, "");
    output = output.replace(/(<div\s+id=["']root["']\s*>)/i, (_, rootStart) => `${rootStart}${metadata.prerenderHtml}`);
  }
  return output;
}

export function applyHomeCriticalCssDelivery(html) {
  const stylesheetPattern = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'](\/assets\/index-[^"']+\.css)["'])[^>]*>/i;
  return html.replace(stylesheetPattern, (stylesheet, href) => [
    `<link rel="preload" as="style" href="${href}" crossorigin data-dc-app-style onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript>${stylesheet}</noscript>`,
  ].join(""));
}
