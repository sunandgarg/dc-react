import {
  UPGRAD_PROGRAM_MEDIA,
  type UpgradProgramMedia,
} from "@/lib/upgradProgramMedia.generated";
import {
  UPGRAD_PROGRAM_CERTIFICATE_MEDIA,
  type UpgradProgramCertificateMedia,
} from "@/lib/upgradProgramCertificateMedia.generated";

type PremiumProgramIdentity = {
  college_name?: unknown;
  title?: unknown;
  slug?: unknown;
  tag?: unknown;
  hero_image?: unknown;
  image_url?: unknown;
  institute_logo?: unknown;
  certificate_image?: unknown;
  degree_image?: unknown;
};

export type ResolvedPremiumProgramMedia = {
  /** Programme artwork used on the programme detail page. */
  detailHeroImage: string;
  /** Compact catalogue artwork; selected institute programmes use a campus image. */
  cardImage: string;
  /** @deprecated Prefer detailHeroImage. Kept for existing callers. */
  heroImage: string;
  instituteLogo: string;
  certificateImage: string;
  degreeImage: string;
};

const IIT_IIM_PROGRAM_PATTERN = /(?:^|[^a-z0-9])(?:iiit|iit|iim)(?=$|[^a-z0-9])/i;
const INSTITUTE_LONG_NAME_PATTERN = /\b(?:indian institute of (?:technology|management|information technology)|international institute of information technology)\b/i;
const UPGRAD_MEDIA_BY_SLUG = UPGRAD_PROGRAM_MEDIA as Readonly<Record<string, UpgradProgramMedia>>;
const UPGRAD_CERTIFICATE_MEDIA_BY_SLUG = UPGRAD_PROGRAM_CERTIFICATE_MEDIA as Readonly<Record<string, UpgradProgramCertificateMedia>>;

/**
 * Campus-first catalogue images approved for the IIT, IIM and IIIT cards.
 * Detail pages intentionally use the richer UpGrad programme artwork instead.
 */
const IIT_IIM_CARD_IMAGE_BY_SLUG: Readonly<Record<string, string>> = {
  "certificate-programme-in-general-management-for-young-leaders-ylp-from-iimb-iim-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919921915-t6c9u8.webp",
  "chief-data-and-ai-officer-program-iiit-b-and-iim-udaipur":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919906576-s0kch4.webp",
  "chief-technology-officer-and-ai-leadership-programme-iiit-b-and-iim-udaipur":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919906576-s0kch4.webp",
  "executive-diploma-in-ds-and-ai-the-international-institute-of-information-technology-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "executive-diploma-in-machine-learning-and-ai-iiit-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "executive-post-graduate-certificate-in-ai-native-software-engineering-iit-kharagpur-iit-kharagpur":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919914234-ua4doe.webp",
  "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919914234-ua4doe.webp",
  "executive-post-graduate-certificate-in-data-science-and-ai-iiit-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "executive-post-graduate-programme-in-applied-ai-and-agentic-ai-iiit-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "executive-programme-in-generative-ai-and-agentic-ai-for-leaders-iiit-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "mba-from-ljmu-with-iim-udaipur-certification-liverpool-john-moores-university":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919852837-n72rdr.webp",
  "mba-from-paris-school-of-business-with-certification-from-iim-lucknow-psb-mba-iiml-certification":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919918240-3p7fbo.webp",
  "professional-certificate-programme-in-ai-for-business-professionals-iim-kozhikode":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919934865-kk6j2x.webp",
  "professional-certificate-programme-in-data-science-and-agentic-ai-iiit-bangalore":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919939533-hb4spu.webp",
  "professional-certification-in-hr-management-and-analytics-iim-kozhikode":
    "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919910468-9y2iej.webp",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

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

/**
 * Resolves audited upGrad artwork first, then preserves database media only
 * for non-IIT/IIM programmes. Empty strings keep callers simple when a
 * programme has no verified certificate or degree artwork.
 */
export function resolvePremiumProgramMedia(
  program: PremiumProgramIdentity | null | undefined,
): ResolvedPremiumProgramMedia {
  const slug = stringValue(program?.slug);
  const curated = UPGRAD_MEDIA_BY_SLUG[slug];
  const auditedCertificate = UPGRAD_CERTIFICATE_MEDIA_BY_SLUG[slug]?.certificateImage || curated?.certificateImage || "";
  const isIitIim = isIitIimProgram(program);
  const detailHeroImage = curated?.heroImage
    || stringValue(program?.hero_image)
    || stringValue(program?.image_url);

  return {
    detailHeroImage,
    cardImage: IIT_IIM_CARD_IMAGE_BY_SLUG[slug] || detailHeroImage,
    heroImage: detailHeroImage,
    instituteLogo: curated?.instituteLogo
      || stringValue(program?.institute_logo),
    certificateImage: auditedCertificate || (isIitIim ? "" : stringValue(program?.certificate_image)),
    // IIT/IIM sample credentials must come from the audited upGrad media set;
    // never display an unverified database fallback on those programme pages.
    degreeImage: isIitIim ? "" : stringValue(program?.degree_image),
  };
}
