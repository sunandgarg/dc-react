const SITE_URL = "https://dekhocampus.com";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const API_URL = (process.env.API_URL || process.env.VITE_API_URL || "").replace(/\/$/, "");

const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/auth", "/onboarding", "/target-dashboard", "/my-targets"];
const ENTITY_CONFIG = {
  colleges: {
    table: "colleges", label: "Colleges", name: "name", schema: "CollegeOrUniversity",
    listSelect: "slug,name,short_name,city,state,description,updated_at",
    detailSelect: "slug,name,short_name,location,city,state,type,category,rating,reviews,courses_count,fees,placement,ranking,image,logo,tags,established,description,highlights,facilities,approvals,naac_grade,top_recruiters,updated_at,eligibility_criteria,admission_process,scholarship_details,hostel_life,cutoff,course_fee_content,placement_content,rankings_content,facilities_content,meta_title,meta_description,admission_deadline",
    sections: [
      ["Overview", ["description", "highlights"]],
      ["Admissions", ["admission_process", "eligibility_criteria", "admission_deadline"]],
      ["Courses and fees", ["course_fee_content", "courses_count", "fees"]],
      ["Placements", ["placement_content", "placement", "top_recruiters"]],
      ["Cutoffs", ["cutoff"]],
      ["Rankings and approvals", ["rankings_content", "ranking", "approvals", "naac_grade"]],
      ["Scholarships", ["scholarship_details"]],
      ["Facilities and hostel", ["facilities_content", "facilities", "hostel_life"]],
      ["Location", ["location", "city", "state"]],
    ],
  },
  courses: {
    table: "courses", label: "Courses", name: "name", schema: "Course",
    listSelect: "slug,name,full_name,category,duration,description,updated_at",
    detailSelect: "slug,name,full_name,category,duration,level,colleges_count,avg_fees,avg_salary,growth,description,eligibility,top_exams,careers,subjects,image,mode,specializations,updated_at,short_description,domain,duration_type,study_type,rating,fee_type,fee,low_fee,high_fee,about_content,scope_content,subjects_content,placements_content,admission_process,fees_content,cutoff_content,specialization_content,recruiters_content,syllabus_content,meta_title,meta_description",
    sections: [
      ["Overview", ["short_description", "description", "about_content"]],
      ["Eligibility and admission", ["eligibility", "admission_process"]],
      ["Duration, level and study mode", ["duration", "duration_type", "level", "mode", "study_type"]],
      ["Fees", ["fees_content", "avg_fees", "fee", "low_fee", "high_fee", "fee_type"]],
      ["Syllabus and subjects", ["syllabus_content", "subjects_content", "subjects"]],
      ["Specialisations", ["specialization_content", "specializations"]],
      ["Career scope and placements", ["scope_content", "placements_content", "careers", "avg_salary", "growth"]],
      ["Exams and recruiters", ["top_exams", "recruiters_content"]],
    ],
  },
  exams: {
    table: "exams", label: "Exams", name: "name", schema: "Event",
    listSelect: "slug,name,short_name,category,level,exam_date,description,updated_at",
    detailSelect: "slug,name,full_name,short_name,category,level,exam_date,applicants,eligibility,mode,description,important_dates,syllabus,top_colleges,image,registration_url,duration,exam_type,language,frequency,application_mode,status,updated_at,application_start_date,application_end_date,result_date,website,negative_marking,seats,age_limit,sample_paper_url,summary_content,application_process,exam_pattern,cutoff_content,preparation_tips,counselling_content,center_content,question_paper,result_content,dates_content,meta_title,meta_description,question_papers,brochure_url",
    sections: [
      ["Overview", ["summary_content", "description"]],
      ["Eligibility", ["eligibility", "age_limit"]],
      ["Important dates", ["dates_content", "important_dates", "application_start_date", "application_end_date", "exam_date", "result_date"]],
      ["Application process", ["application_process", "application_mode", "registration_url"]],
      ["Exam pattern and syllabus", ["exam_pattern", "syllabus", "duration", "mode", "language", "negative_marking"]],
      ["Cutoffs and results", ["cutoff_content", "result_content"]],
      ["Preparation and question papers", ["preparation_tips", "question_paper", "question_papers", "sample_paper_url"]],
      ["Counselling and centres", ["counselling_content", "center_content"]],
      ["Official information", ["website", "brochure_url"]],
    ],
  },
  news: {
    table: "articles", label: "News", name: "title", schema: "Article",
    listSelect: "slug,title,description,category,created_at,updated_at",
    detailSelect: "slug,title,description,content,vertical,category,author,featured_image,tags,meta_title,meta_description,created_at,updated_at",
    sections: [["Article", ["description", "content"]]],
  },
};

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function plainText(value) {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join("; ");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${plainText(item)}`).join("; ");
  return String(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}

function publicImage(value) {
  const image = String(value || "").trim();
  return /^https?:\/\//i.test(image) ? image : "";
}

function apiHeaders() {
  const headers = { apikey: SUPABASE_KEY };
  if (SUPABASE_KEY && !/^sb_publishable_/i.test(SUPABASE_KEY)) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  return headers;
}

function parseSlugWithId(param = "") {
  const value = decodeURIComponent(String(param || "")).trim();
  const match = value.match(/^(.*?)-(\d+)$/);
  if (!match) return { slug: value };
  return { slug: match[1], shortId: Number(match[2]) };
}

async function fetchRows(config, slug, limit = 1) {
  if (!API_URL && (!SUPABASE_URL || !SUPABASE_KEY)) return [];
  const parsed = slug ? parseSlugWithId(slug) : { slug: "" };
  const query = new URLSearchParams({ select: slug ? config.detailSelect : config.listSelect, is_active: "eq.true", limit: String(limit) });
  if (slug && parsed.shortId) query.set("or", `(short_id.eq.${parsed.shortId},slug.eq.${parsed.slug})`);
  else if (slug) query.set("slug", `eq.${parsed.slug}`);
  else query.set("order", `${config.name}.asc`);
  const dataBase = API_URL ? `${API_URL}/v1/rest` : `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
  const response = await fetch(`${dataBase}/${config.table}?${query}`, { headers: API_URL ? {} : apiHeaders() });
  if (!response.ok) return [];
  return response.json();
}

function nav() {
  return `<nav aria-label="Primary"><a href="${SITE_URL}/">Home</a><a href="${SITE_URL}/colleges">Colleges</a><a href="${SITE_URL}/courses">Courses</a><a href="${SITE_URL}/exams">Exams</a><a href="${SITE_URL}/scholarships">Scholarships</a><a href="${SITE_URL}/careers">Careers</a><a href="${SITE_URL}/news">News</a></nav>`;
}

function documentShell({ title, description, canonical, body, schema, image = "" }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(plainText(description).slice(0, 320));
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><meta name="description" content="${safeDescription}"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}">${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script><style>body{max-width:1100px;margin:auto;padding:24px;font:16px/1.65 system-ui;color:#111827}nav{display:flex;gap:16px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #e5e7eb}a{color:#245bd7}h1{font-size:2.2rem;line-height:1.15}h2{margin-top:2rem}article{max-width:850px}.meta{color:#4b5563}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.card{padding:16px;border:1px solid #e5e7eb;border-radius:12px}.card a{font-weight:700}</style></head><body>${nav()}${body}<footer><p>DekhoCampus is an education discovery platform. Verify time-sensitive information against official sources.</p><a href="${SITE_URL}/legal/privacy-policy">Privacy</a> · <a href="${SITE_URL}/legal/terms-and-conditions">Terms</a></footer></body></html>`;
}

function detailPage(config, row, canonical) {
  const name = plainText(row[config.name] || row.slug || config.label);
  const description = plainText(row.meta_description || row.short_description || row.description || `${name} information on DekhoCampus.`);
  const sections = config.sections.map(([heading, fields]) => {
    const paragraphs = fields.map((field) => plainText(row[field])).filter(Boolean);
    return paragraphs.length ? `<section><h2>${escapeHtml(heading)}</h2>${paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join("")}</section>` : "";
  }).filter(Boolean).join("");
  const image = publicImage(row.image || row.logo || row.featured_image);
  const body = `<main><article>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="900" height="500">` : ""}<h1>${escapeHtml(name)}</h1><p class="meta">${escapeHtml([row.category, row.city, row.state, row.level].filter(Boolean).join(" · "))}</p><p>${escapeHtml(description)}</p>${sections}</article></main>`;
  const schema = { "@context": "https://schema.org", "@type": config.schema, name, headline: name, description, url: canonical, image: image || undefined, dateModified: row.updated_at || undefined, mainEntityOfPage: canonical, provider: { "@type": "EducationalOrganization", name: "DekhoCampus", url: SITE_URL } };
  return documentShell({ title: row.meta_title || `${name} - ${config.label} | DekhoCampus`, description, canonical, body, schema, image });
}

async function directoryPage(config, key, canonical) {
  const rows = await fetchRows(config, "", 100);
  const cards = rows.map((row) => {
    const name = plainText(row[config.name] || row.slug);
    const detail = plainText(row.description || [row.city, row.state, row.category, row.level].filter(Boolean).join(" · "));
    return `<article class="card"><a href="${SITE_URL}/${key}/${encodeURIComponent(row.slug)}">${escapeHtml(name)}</a>${detail ? `<p>${escapeHtml(detail.slice(0, 260))}</p>` : ""}</article>`;
  }).join("");
  const description = `Browse active ${config.label.toLowerCase()} on DekhoCampus with direct links to detailed information.`;
  const body = `<main><h1>${escapeHtml(config.label)}</h1><p>${escapeHtml(description)}</p><section class="cards">${cards}</section></main>`;
  return documentShell({ title: `${config.label} in India | DekhoCampus`, description, canonical, body, schema: { "@context": "https://schema.org", "@type": "CollectionPage", name: config.label, description, url: canonical } });
}

async function homePage() {
  const groups = await Promise.all(Object.keys(ENTITY_CONFIG).map(async (key) => [key, await fetchRows(ENTITY_CONFIG[key], "", 12)]));
  const sections = groups.map(([key, rows]) => {
    const config = ENTITY_CONFIG[key];
    const items = rows.map((row) => `<li><a href="${SITE_URL}/${key}/${encodeURIComponent(row.slug)}">${escapeHtml(plainText(row[config.name]))}</a></li>`).join("");
    return `<section><h2>Explore ${escapeHtml(config.label)}</h2><ul>${items}</ul><a href="${SITE_URL}/${key}">View all ${escapeHtml(config.label.toLowerCase())}</a></section>`;
  }).join("");
  const description = "Discover colleges, courses, entrance exams, scholarships, careers and education news in India with DekhoCampus.";
  const body = `<main><h1>Discover Your Ideal College, Course, Exam and Career Path</h1><p>${description}</p>${sections}</main>`;
  const schema = { "@context": "https://schema.org", "@type": "WebSite", name: "DekhoCampus", url: SITE_URL, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/colleges?q={search_term_string}`, "query-input": "required name=search_term_string" } };
  return documentShell({ title: "DekhoCampus - Find Colleges, Courses and Exams", description, canonical: `${SITE_URL}/`, body, schema });
}

export default async function handler(request, response) {
  const rawPath = Array.isArray(request.query?.path) ? request.query.path.join("/") : String(request.query?.path || "/");
  const path = `/${rawPath}`.replace(/\/{2,}/g, "/").split("?")[0].replace(/\/$/, "") || "/";
  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return response.status(404).setHeader("Cache-Control", "no-store").send("Not found");
  const send = (html, maxAge = 1800) => response.status(200).setHeader("Content-Type", "text/html; charset=utf-8").setHeader("Vercel-CDN-Cache-Control", `s-maxage=${maxAge}, stale-while-revalidate=86400`).send(html);
  try {
    if (path === "/") return send(await homePage());
    const parts = path.split("/").filter(Boolean);
    const key = parts[0] === "articles" ? "news" : parts[0];
    const config = ENTITY_CONFIG[key];
    const canonical = `${SITE_URL}${path}`;
    if (config && parts[1] && parts[1] !== "tag") {
      const rows = await fetchRows(config, decodeURIComponent(parts[1]), 1);
      if (rows[0]) return send(detailPage(config, rows[0], canonical));
    }
    if (config) return send(await directoryPage(config, key, canonical));
    const title = parts.map((part) => part.replace(/-/g, " ")).join(" - ") || "DekhoCampus";
    const body = `<main><h1>${escapeHtml(title)}</h1><p>Explore this public education resource on DekhoCampus.</p><p><a href="${SITE_URL}/colleges">Browse colleges</a>, <a href="${SITE_URL}/courses">courses</a>, <a href="${SITE_URL}/exams">exams</a> and <a href="${SITE_URL}/news">education news</a>.</p></main>`;
    return send(documentShell({ title: `${title} | DekhoCampus`, description: `Explore ${title} on DekhoCampus.`, canonical, body, schema: { "@context": "https://schema.org", "@type": "WebPage", name: title, url: canonical } }), 3600);
  } catch {
    return response.status(503).setHeader("Cache-Control", "no-store").send("Crawler rendering is temporarily unavailable.");
  }
}
