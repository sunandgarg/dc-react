export interface ArticleAuthorOption { id: string; name: string }
export interface AdminArticleFilters {
  createdSince?: string;
  author?: ArticleAuthorOption;
  status?: string;
  category?: string;
}

export function sortArticleAuthors(authors: ArticleAuthorOption[]) {
  const rank = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (/^manav\b/.test(normalized)) return 0;
    if (/^neha\b/.test(normalized)) return 1;
    if (/^geethika\s+reddy\b/.test(normalized)) return 2;
    return 3;
  };
  return [...authors].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

export function articleCreatedSince(days: string, now = Date.now()) {
  return ["1", "2", "7"].includes(days) ? new Date(now - Number(days) * 86_400_000).toISOString() : undefined;
}

export function articleAuthorFilter(author: ArticleAuthorOption) {
  // Match linked profiles as well as older articles using only the byline text.
  return `author_id.eq.${JSON.stringify(author.id)},author.eq.${JSON.stringify(author.name)}`;
}
