import { ARTICLE_LANGUAGES } from "../../public/article-languages.js";

const targetLanguages = ARTICLE_LANGUAGES.filter(({ code }) => code !== "en");
const isPublished = (article) => article?.status === "Published" && article.is_active !== false && article.is_active !== 0;

export async function ensureArticleTranslationQueue(db) {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS article_translation_queue (
    english_article_id CHAR(36) NOT NULL,
    language_code VARCHAR(5) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (english_article_id, language_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

/** Run in the publication transaction; repeated saves never reset the queue or existing versions. */
export async function queueArticleTranslations(tx, article, previous = null) {
  if (article.site_scope !== "dekhocampus" || (article.language_code || "en") !== "en" || article.english_article_id
    || !isPublished(article) || isPublished(previous)) return;
  if (!article.id) throw new Error("Save the English article before queuing translations.");
  await tx.$executeRawUnsafe(
    `INSERT INTO article_translation_queue (english_article_id, language_code)
     VALUES ${targetLanguages.map(() => "(?, ?)").join(", ")}
     ON DUPLICATE KEY UPDATE english_article_id = article_translation_queue.english_article_id`,
    ...targetLanguages.flatMap(({ code }) => [article.id, code]),
  );
}

// No worker or provider calls: processing remains paused until a free engine is connected.
export async function articleTranslationQueueStatus(db, body, access) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(body?.article_id || "")) || body?.site_scope !== "dekhocampus") {
    throw Object.assign(new Error("Choose a DekhoCampus English article."), { status: 400, code: "INVALID_TRANSLATION_QUEUE_REQUEST" });
  }
  const [original] = await db.$queryRawUnsafe(
    "SELECT id, status, is_active, created_by FROM articles WHERE id = ? AND site_scope = 'dekhocampus' AND language_code = 'en' AND english_article_id IS NULL LIMIT 1",
    body.article_id,
  );
  if (!original || (access.restrictToOwnDrafts && !isPublished(original) && original.created_by !== access.actorUserId)) {
    throw Object.assign(new Error("English article was not found."), { status: 404, code: "ARTICLE_NOT_FOUND" });
  }
  const slots = await db.$queryRawUnsafe(
    `SELECT q.language_code, q.created_at, a.id AS article_id, a.status, a.is_active
     FROM article_translation_queue q LEFT JOIN articles a
       ON a.english_article_id = q.english_article_id AND a.language_code = q.language_code AND a.site_scope = 'dekhocampus'
     WHERE q.english_article_id = ? ORDER BY q.language_code`, original.id,
  );
  return {
    engine_status: "not_connected",
    slots: slots.map((slot) => ({
      language_code: slot.language_code, requested_at: slot.created_at, article_id: slot.article_id || null,
      status: slot.article_id ? (isPublished(slot) ? "published" : "existing_draft") : (isPublished(original) ? "waiting_engine" : "paused_original"),
    })),
  };
}
