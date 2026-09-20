import {
  UPGRAD_PROGRAM_MEDIA,
  type UpgradProgramMedia,
} from "@/lib/upgradProgramMedia.generated";

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
  heroImage: string;
  instituteLogo: string;
  certificateImage: string;
  degreeImage: string;
};

const IIT_IIM_PROGRAM_PATTERN = /(?:^|[^a-z0-9])(?:iiit|iit|iim)(?=$|[^a-z0-9])/i;
const INSTITUTE_LONG_NAME_PATTERN = /\b(?:indian institute of (?:technology|management|information technology)|international institute of information technology)\b/i;
const UPGRAD_MEDIA_BY_SLUG = UPGRAD_PROGRAM_MEDIA as Readonly<Record<string, UpgradProgramMedia>>;

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
 * Resolves audited AWS copies first, then preserves the corresponding database
 * field as a fallback. Empty strings keep callers simple when a programme has
 * no certificate or degree artwork.
 */
export function resolvePremiumProgramMedia(
  program: PremiumProgramIdentity | null | undefined,
): ResolvedPremiumProgramMedia {
  const slug = stringValue(program?.slug);
  const curated = UPGRAD_MEDIA_BY_SLUG[slug];

  return {
    heroImage: curated?.heroImage
      || stringValue(program?.hero_image)
      || stringValue(program?.image_url),
    instituteLogo: curated?.instituteLogo
      || stringValue(program?.institute_logo),
    certificateImage: curated?.certificateImage
      || stringValue(program?.certificate_image),
    degreeImage: stringValue(program?.degree_image),
  };
}
