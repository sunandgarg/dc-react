function inputError(message) {
  return Object.assign(new Error(message), { status: 400, code: "INVALID_WRITER_PROFILE" });
}

function cleanText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function cleanUrl(value) {
  const raw = cleanText(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
  } catch { /* invalid URL */ }
  throw inputError("Profile links and photos must use a valid HTTPS URL");
}

function authorSlug(name, userId) {
  const base = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "writer";
  return `${base}-${userId.slice(0, 8)}`;
}

export async function ensureWriterAuthorProfile(database, userId, nameHint = "") {
  const existing = await database.authors.findFirst({ where: { user_id: userId } });
  if (existing) return existing;
  const profile = await database.profiles.findFirst({ where: { user_id: userId } });
  const name = cleanText(profile?.display_name || nameHint || "DekhoCampus Writer", 120);
  return database.authors.create({ data: {
    name, slug: authorSlug(name, userId), user_id: userId,
    designation: "Content Writer", photo: "", short_bio: "", bio: "",
    expertise: [], email: "", linkedin_url: "", twitter_url: "", website_url: "",
    display_order: 0, is_active: true,
  } });
}

export async function handleWriterProfile(request, userId, database) {
  if (request.method === "GET") {
    const [author, profile] = await Promise.all([
      database.authors.findFirst({ where: { user_id: userId } }),
      database.profiles.findFirst({ where: { user_id: userId } }),
    ]);
    return { author, suggested_name: profile?.display_name || "" };
  }
  if (request.method !== "POST") {
    throw Object.assign(new Error("Use GET or POST for your writer profile"), { status: 405, code: "METHOD_NOT_ALLOWED" });
  }
  const input = await request.json().catch(() => ({}));
  if (!input || typeof input !== "object" || Array.isArray(input)) throw inputError("A profile object is required");
  const author = await ensureWriterAuthorProfile(database, userId);
  const name = cleanText(input.name ?? author.name, 120);
  if (!name) throw inputError("Enter your byline name");
  const expertise = Array.isArray(input.expertise)
    ? input.expertise.slice(0, 12).map((item) => cleanText(item, 60)).filter(Boolean)
    : author.expertise;
  return database.authors.update({
    where: { id: author.id },
    data: {
      name,
      designation: cleanText(input.designation ?? author.designation, 120),
      photo: cleanUrl(input.photo ?? author.photo),
      short_bio: cleanText(input.short_bio ?? author.short_bio, 400),
      bio: cleanText(input.bio ?? author.bio, 5000),
      expertise,
      linkedin_url: cleanUrl(input.linkedin_url ?? author.linkedin_url),
      twitter_url: cleanUrl(input.twitter_url ?? author.twitter_url),
      website_url: cleanUrl(input.website_url ?? author.website_url),
      updated_at: new Date(),
    },
  });
}

export function stampWriterByline(table, input, author, userId) {
  const rows = Array.isArray(input) ? input : [input];
  if (rows.length !== 1 || !rows[0] || typeof rows[0] !== "object" || Array.isArray(rows[0])) {
    throw inputError("Submit one new item at a time");
  }
  const row = { ...rows[0] };
  const name = table === "articles" ? row.title : row.name;
  if (!String(name || "").trim() || !String(row.slug || "").trim()) {
    throw inputError("A new item needs a name or title and a slug");
  }
  if (table === "articles") {
    const visible = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (visible(row.description).length < 10 || visible(row.content).length < 20) {
      throw inputError("Add a useful description and article body before submitting for approval");
    }
  }
  delete row.id;
  delete row.created_at;
  delete row.updated_at;
  row.author_id = author.id;
  if (table === "articles") {
    row.author = author.name;
    row.created_by = userId;
  }
  return row;
}
