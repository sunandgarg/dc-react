import identities from "../../shared/exam-identities.json";

type ExamBrandingRecord = {
  slug?: string | null;
  logo?: string | null;
  name?: string | null;
  short_name?: string | null;
  full_name?: string | null;
};

export function resolveExamLogo(exam: ExamBrandingRecord): string {
  const logo = String(exam.logo || "").trim();
  const identity = identities[String(exam.slug || "") as keyof typeof identities];
  // Earlier generated placeholders contain no official mark.
  if (!logo || /\/exam-logos-v[123]\//i.test(logo) || logo === "https://puchd.ac.in/asset/pu-logo.png") {
    return identity?.logo || "";
  }
  return logo;
}

export function resolveExamNames(exam: ExamBrandingRecord) {
  const identity = identities[String(exam.slug || "") as keyof typeof identities];
  const shortName = String(exam.short_name?.trim() || identity?.short_name || exam.name || "Exam").trim();
  const savedName = String(exam.full_name?.trim() || identity?.full_name || exam.name || "").trim();
  const fullName = /\b20\d{2}\s*[:|]|\b(?:dates?.*eligibility|eligibility.*pattern)\b/i.test(savedName)
    ? identity?.full_name || savedName : savedName;
  return { shortName, fullName: fullName === shortName ? "" : fullName };
}
