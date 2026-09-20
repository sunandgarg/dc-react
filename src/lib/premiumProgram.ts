type PremiumProgramIdentity = {
  college_name?: unknown;
  title?: unknown;
  slug?: unknown;
  tag?: unknown;
  hero_image?: unknown;
  image_url?: unknown;
  institute_logo?: unknown;
};

const IIT_IIM_PROGRAM_PATTERN = /(?:^|[^a-z0-9])(?:iiit|iit|iim)(?=$|[^a-z0-9])/i;
const INSTITUTE_LONG_NAME_PATTERN = /\b(?:indian institute of (?:technology|management|information technology)|international institute of information technology)\b/i;

type CuratedProgramMedia = {
  heroImage: string;
  instituteLogo: string;
};

/**
 * Approved, locally optimised derivatives of the programme media supplied by
 * the upstream programme catalogue. Keeping this mapping keyed by the stable
 * programme slug prevents a generic category cover from replacing the actual
 * institute/campus artwork when imported records are refreshed.
 */
const CURATED_IIT_IIM_MEDIA: Record<string, CuratedProgramMedia> = {
  "certificate-programme-in-general-management-for-young-leaders-ylp-from-iimb-iim-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-9801b33c5a49928d.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-defd301015aed225.webp",
  },
  "chief-data-and-ai-officer-program-iiit-b-and-iim-udaipur": {
    heroImage: "/assets/programs/iit-iim/hero-424f097b00f97a3c.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-3343b8e729d7401d.webp",
  },
  "chief-technology-officer-and-ai-leadership-programme-iiit-b-and-iim-udaipur": {
    heroImage: "/assets/programs/iit-iim/hero-424f097b00f97a3c.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-3343b8e729d7401d.webp",
  },
  "executive-diploma-in-ds-and-ai-the-international-institute-of-information-technology-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "executive-diploma-in-machine-learning-and-ai-iiit-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "executive-post-graduate-certificate-in-ai-native-software-engineering-iit-kharagpur-iit-kharagpur": {
    heroImage: "/assets/programs/iit-iim/hero-87022555eaf20fdc.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-1e605b07713df465.webp",
  },
  "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur": {
    heroImage: "/assets/programs/iit-iim/hero-87022555eaf20fdc.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-1e605b07713df465.webp",
  },
  "executive-post-graduate-certificate-in-data-science-and-ai-iiit-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "executive-post-graduate-programme-in-applied-ai-and-agentic-ai-iiit-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "executive-programme-in-generative-ai-and-agentic-ai-for-leaders-iiit-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "mba-from-ljmu-with-iim-udaipur-certification-liverpool-john-moores-university": {
    heroImage: "/assets/programs/iit-iim/hero-12ef08e89400eb21.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-9cd37e714745a7c3.webp",
  },
  "mba-from-paris-school-of-business-with-certification-from-iim-lucknow-psb-mba-iiml-certification": {
    heroImage: "/assets/programs/iit-iim/hero-904cc7262dc58f77.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-cfcc848f51662807.webp",
  },
  "professional-certificate-programme-in-ai-for-business-professionals-iim-kozhikode": {
    heroImage: "/assets/programs/iit-iim/hero-d31dee4e6e6889e6.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-0c59a2068bae4abf.webp",
  },
  "professional-certificate-programme-in-data-science-and-agentic-ai-iiit-bangalore": {
    heroImage: "/assets/programs/iit-iim/hero-e8cc86f3107cd9e2.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-f4f400a6ae70a6ab.webp",
  },
  "professional-certification-in-hr-management-and-analytics-iim-kozhikode": {
    heroImage: "/assets/programs/iit-iim/hero-4e4a8bff277c3a53.webp",
    instituteLogo: "/assets/programs/iit-iim/logo-0c59a2068bae4abf.webp",
  },
};

/**
 * Identifies programmes from IIT, IIM and IIIT institutes without matching
 * unrelated words such as "summit". Data imports are not consistent about
 * which field contains the institute name, so the public identifiers and
 * imported programme tag are all considered.
 */
export function isIitIimProgram(program: PremiumProgramIdentity | null | undefined) {
  if (!program) return false;

  return [program.college_name, program.title, program.slug, program.tag]
    .filter((value): value is string => typeof value === "string")
    .some((value) => IIT_IIM_PROGRAM_PATTERN.test(value) || INSTITUTE_LONG_NAME_PATTERN.test(value));
}

export function resolvePremiumProgramMedia(program: PremiumProgramIdentity | null | undefined): CuratedProgramMedia {
  const slug = typeof program?.slug === "string" ? program.slug : "";
  const curated = CURATED_IIT_IIM_MEDIA[slug];

  return {
    heroImage: curated?.heroImage
      || (typeof program?.hero_image === "string" ? program.hero_image : "")
      || (typeof program?.image_url === "string" ? program.image_url : ""),
    instituteLogo: curated?.instituteLogo
      || (typeof program?.institute_logo === "string" ? program.institute_logo : ""),
  };
}
