// Shared by the editor, publication boundary and crawler-visible article head.
export const ARTICLE_LANGUAGES = [
  { code: "en", label: "English", faq: "Frequently Asked Questions" },
  { code: "hi", label: "हिन्दी", faq: "अक्सर पूछे जाने वाले प्रश्न", script: "Devanagari" },
  { code: "ta", label: "தமிழ்", faq: "அடிக்கடி கேட்கப்படும் கேள்விகள்", script: "Tamil" },
  { code: "te", label: "తెలుగు", faq: "తరచుగా అడిగే ప్రశ్నలు", script: "Telugu" },
  { code: "kn", label: "ಕನ್ನಡ", faq: "ಪದೇ ಪದೇ ಕೇಳಲಾಗುವ ಪ್ರಶ್ನೆಗಳು", script: "Kannada" },
  { code: "ml", label: "മലയാളം", faq: "പതിവായി ചോദിക്കുന്ന ചോദ്യങ്ങൾ", script: "Malayalam" },
  { code: "gu", label: "ગુજરાતી", faq: "વારંવાર પૂછાતા પ્રશ્નો", script: "Gujarati" },
  { code: "mr", label: "मराठी", faq: "वारंवार विचारले जाणारे प्रश्न", script: "Devanagari" },
  { code: "bn", label: "বাংলা", faq: "প্রায়শই জিজ্ঞাসিত প্রশ্ন", script: "Bengali" },
  { code: "pa", label: "ਪੰਜਾਬੀ", faq: "ਅਕਸਰ ਪੁੱਛੇ ਜਾਣ ਵਾਲੇ ਸਵਾਲ", script: "Gurmukhi" },
];
export const VERNACULAR_CATEGORY = "Vernacular";
export function articleNewsLanguage(category = "", language = "") {
  if (category !== VERNACULAR_CATEGORY) return "en";
  return ARTICLE_LANGUAGES.some(({ code }) => code !== "en" && code === language) ? language : null;
}
export function articleNewsCategories(categories = []) {
  return [{ slug: "vernacular", name: VERNACULAR_CATEGORY }, ...categories.filter(({ name }) => name !== VERNACULAR_CATEGORY)];
}
export function articleLanguage(code) {
  return ARTICLE_LANGUAGES.find((language) => language.code === code) || ARTICLE_LANGUAGES[0];
}
export function isFaqHeading(text) {
  const clean = String(text || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
  return /^(?:FAQs?(?:\s*[:(–-].*)?|Frequently asked questions(?:\s*[:(–-].*)?|Questions students (?:are asking|ask))$/i.test(clean)
    || ARTICLE_LANGUAGES.some(({ faq }) => faq === clean);
}
export function hasBodyFaqs(content) {
  return [...String(content || "").matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].some((match) => isFaqHeading(match[1]))
    || String(content || "").split("\n").some((line) => /^#{1,6}\s/.test(line) && isFaqHeading(line.replace(/^#{1,6}\s+/, "")));
}
export function translationTextError(article) {
  const language = ARTICLE_LANGUAGES.find(({ code }) => code === (article.language_code || "en"));
  if (!language) return "Choose a supported article language.";
  if (language.code === "en") return null;
  const pattern = new RegExp(`\\p{Script=${language.script}}`, "u");
  for (const key of ["title", "description", "content", "meta_title", "meta_description"]) {
    const text = String(article[key] || "").replace(/<[^>]*>/g, " ");
    if (!pattern.test(text)) return `Write the ${key.replaceAll("_", " ")} in ${language.label} before publishing.`;
  }
  if (Array.isArray(article.faqs) && article.faqs.some((faq) => !pattern.test(faq.question || "") || !pattern.test(faq.answer || ""))) {
    return `Translate every FAQ into ${language.label} before publishing.`;
  }
  return null;
}
export function orderedArticleVersions(versions = []) {
  return [...(versions || [])].sort((a, b) => Number((b.language_code || "en") === "en") - Number((a.language_code || "en") === "en"));
}
export function articleAlternates(versions = []) {
  const result = (versions || []).filter((version) => version.slug && ARTICLE_LANGUAGES.some(({ code }) => code === (version.language_code || "en")))
    .map((version) => ({ language: version.language_code || "en", href: `/news/${version.slug}` }));
  const english = result.find(({ language }) => language === "en");
  return english ? [...result, { ...english, language: "x-default" }] : result;
}
