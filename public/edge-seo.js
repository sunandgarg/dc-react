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
    const title = `${subject} Colleges in ${place} 2026 - Fees, Admissions & Rankings | DekhoCampus`;
    return { title, description: `Explore ${subject.toLowerCase()} colleges in ${place}. Compare fees, courses, placements, rankings and 2026 admission details.` };
  }
  if (pathname === "/courses") {
    const subject = queryValue(url, "group") || queryValue(url, "specialization") || queryValue(url, "stream") || "Top Courses";
    const mode = queryValue(url, "mode");
    const title = `${subject}${mode ? ` ${mode}` : ""} 2026 - Eligibility, Fees & Colleges | DekhoCampus`;
    return { title, description: `Explore ${subject} courses${mode ? ` in ${mode} mode` : ""}. Compare eligibility, duration, fees, specializations and top colleges.` };
  }
  const subject = queryValue(url, "group") || queryValue(url, "stream") || queryValue(url, "category") || "Entrance Exams";
  const level = queryValue(url, "level");
  const title = `${subject}${level ? ` ${level}` : ""} Exams 2026 - Dates, Eligibility & Syllabus | DekhoCampus`;
  return { title, description: `Explore ${subject} exams${level ? ` for ${level} level` : ""}, including 2026 dates, eligibility, applications, syllabus and preparation resources.` };
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
  const allowed = LISTING_QUERY_KEYS[pathname];
  if (!allowed) return false;
  const keys = [...url.searchParams.keys()];
  return keys.length > 0 && keys.every((key) => allowed.has(key)) && [...url.searchParams.values()].every((value) => value.trim());
}

export function edgeSeoFor(input) {
  const url = input instanceof URL ? input : new URL(input);
  const pathname = cleanPath(url.pathname);
  const privatePath = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  const indexable = !privatePath && isPublicPath(pathname) && isIndexableQuery(url, pathname);
  const canonicalPath = indexable && url.search ? `${pathname}${url.search}` : pathname;
  const canonical = `${SITE_URL}${canonicalPath === "/" ? "" : canonicalPath}`;

  if (pathname === "/") {
    return {
      canonical: SITE_URL,
      description: "Explore colleges, courses, entrance exams, scholarships and education news with DekhoCampus.",
      indexable: true,
      title: "DekhoCampus - Find Your College, Course & Career",
    };
  }

  const metadata = LISTING_QUERY_KEYS[pathname] ? listingMetadata(url, pathname) : detailMetadata(pathname);
  return { ...metadata, canonical, indexable };
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function replaceOrInsert(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace(/<\/head>/i, `    ${replacement}\n  </head>`);
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
  return output;
}
