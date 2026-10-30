import type { DbArticle } from "@/hooks/useArticlesData";
import type { ArticleAuthorOption } from "./adminArticleFilters";

export type PublicationRow = Pick<DbArticle, "id" | "title" | "slug" | "author" | "author_id" | "language_code" | "created_at">;
export type PublicationPeriod = "today" | "yesterday" | "week" | "month" | "custom";
const DAY = 86_400_000;
const IST = 330 * 60_000;
export const indiaDate = (now = Date.now()) => new Date(now + IST).toISOString().slice(0, 10);

export function publicationDates(period: PublicationPeriod, now = Date.now()) {
  const today = indiaDate(now);
  const ago = (days: number) => indiaDate(now - days * DAY);
  return { start: period === "yesterday" ? ago(1) : period === "week" ? ago(6) : period === "month" ? ago(29) : today,
    end: period === "yesterday" ? ago(1) : today };
}

export function publicationBounds(start: string, end: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end) || start > end) return null;
  return { from: new Date(Date.parse(start) - IST).toISOString(), until: new Date(Date.parse(end) + DAY - IST).toISOString() };
}

export function groupPublications(rows: PublicationRow[], authors: ArticleAuthorOption[]) {
  const names = new Map(authors.map((author) => [author.id, author.name]));
  const byName = new Map<string, string[]>();
  const normalize = (name: string) => name.trim().toLocaleLowerCase();
  authors.forEach(({ id, name }) => byName.set(normalize(name), [...(byName.get(normalize(name)) || []), id]));
  const groups = new Map<string, { key: string; name: string; rows: PublicationRow[]; english: number; vernacular: number }>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const legacyIds = byName.get(normalize(row.author || ""));
    const id = row.author_id || (legacyIds?.length === 1 ? legacyIds[0] : null);
    const key = id ? `id:${id}` : `name:${normalize(row.author || "")}`;
    const group = groups.get(key) || { key, name: (id && names.get(id)) || row.author?.trim() || "Unassigned writer", rows: [], english: 0, vernacular: 0 };
    group.rows.push(row);
    if (!row.language_code || row.language_code === "en") group.english++; else group.vernacular++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name));
}
