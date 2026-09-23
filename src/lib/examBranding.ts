type ExamBrandingRecord = {
  slug?: string | null;
  logo?: string | null;
};

const OFFICIAL_EXAM_LOGOS: Record<string, string> = {
  "pu-cet-ug": "https://puchd.ac.in/asset/pu-logo.png",
};

export function resolveExamLogo(exam: ExamBrandingRecord): string {
  const slug = String(exam.slug || "").trim().toLowerCase();
  return OFFICIAL_EXAM_LOGOS[slug] || String(exam.logo || "").trim();
}

