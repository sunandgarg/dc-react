/** Keep historical dates visible without exposing database timestamp syntax. */
export function formatExamDate(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "TBA";
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(raw);
  if (!isoDate) return raw;
  const [, yearText, monthText, dayText] = isoDate;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return raw;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
