/** Returns the current calendar year as a string. Centralized so all
 * year mentions (titles, SEO, banners, prompts) auto-roll over. */
export const currentYear = (): number => new Date().getFullYear();
export const currentYearStr = (): string => String(currentYear());
export const nextYear = (): number => currentYear() + 1;
export const admissionSessionYear = (date = new Date()): number => {
  const indiaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(date);
  const [year, month] = indiaDate.split("-").map(Number);
  return year + Number(month >= 11);
};
