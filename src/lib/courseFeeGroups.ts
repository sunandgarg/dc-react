export type CollegeFeeRow = {
  id?: string;
  course_slug?: string | null;
  course_name?: string | null;
  course_group?: string | null;
  specialization?: string | null;
  academic_level?: string | null;
  duration?: string | null;
  fee_amount?: number | string | null;
  fee_type?: string | null;
  year?: string | null;
};

export type CollegeFeeLevel = {
  key: string;
  label: string;
  groups: CollegeFeeGroup[];
  courseCount: number;
  lowFee: number | null;
  highFee: number | null;
};

export const ACADEMIC_LEVEL_OPTIONS = ["UG", "PG", "Diploma", "Doctoral", "Certificate", "Other"] as const;

export type CollegeFeeGroup = {
  key: string;
  label: string;
  entries: CollegeFeeRow[];
  specializationCount: number;
  lowFee: number | null;
  highFee: number | null;
  feeTypes: string[];
};

export function countCollegeCourseOfferings(rows: CollegeFeeRow[]): number {
  const identities = new Set<string>();
  for (const row of rows) {
    const course = String(row.course_slug || row.course_name || "").trim().toLowerCase();
    if (!course) continue;
    const specialization = String(row.specialization || "general").trim().toLowerCase() || "general";
    identities.add(`${course}\u001f${specialization}`);
  }
  return identities.size;
}

export const COURSE_GROUP_OPTIONS = [
  "B.E. / B.Tech",
  "M.E. / M.Tech",
  "MBA / PGDM",
  "BBA",
  "BCA",
  "MCA",
  "B.Com",
  "M.Com",
  "B.Sc.",
  "M.Sc.",
  "BA",
  "MA",
  "MBBS",
  "BDS",
  "B.Pharm",
  "M.Pharm",
  "LL.B.",
  "LL.M.",
  "B.Arch",
  "M.Arch",
  "B.Des",
  "M.Des",
  "B.Ed",
  "M.Ed",
  "B.P.Ed",
  "M.P.Ed",
  "BFA",
  "MFA",
  "BPA",
  "MPA",
  "BPT",
  "MPT",
  "BHM / BHMCT",
  "B.Voc",
  "BSW",
  "MSW",
  "Ph.D.",
  "Diploma",
];

const GROUP_RULES: Array<[RegExp, string]> = [
  [/\b(b ?e|b ?tech|bachelor of (engineering|technology))\b/i, "B.E. / B.Tech"],
  [/\b(m ?e|m ?tech|master of (engineering|technology))\b/i, "M.E. / M.Tech"],
  [/\b(mba|pgdm|master of business administration)\b/i, "MBA / PGDM"],
  [/\b(bba|bachelor of business administration)\b/i, "BBA"],
  [/\b(bca|bachelor of computer applications?)\b/i, "BCA"],
  [/\b(mca|master of computer applications?)\b/i, "MCA"],
  [/\b(b ?com|bachelor of commerce)\b/i, "B.Com"],
  [/\b(m ?com|master of commerce)\b/i, "M.Com"],
  [/\b(b ?sc|bachelor of science)\b/i, "B.Sc."],
  [/\b(m ?sc|master of science)\b/i, "M.Sc."],
  [/\b(mbbs|bachelor of medicine)\b/i, "MBBS"],
  [/\b(bds|bachelor of dental surgery)\b/i, "BDS"],
  [/\b(b ?pharm|bachelor of pharmacy)\b/i, "B.Pharm"],
  [/\b(m ?pharm|master of pharmacy)\b/i, "M.Pharm"],
  [/\b(ll ?b|bachelor of laws?)\b/i, "LL.B."],
  [/\b(ll ?m|master of laws?)\b/i, "LL.M."],
  [/\b(b ?arch|bachelor of architecture)\b/i, "B.Arch"],
  [/\b(m ?arch|master of architecture)\b/i, "M.Arch"],
  [/\b(b ?des|bachelor of design)\b/i, "B.Des"],
  [/\b(m ?des|master of design)\b/i, "M.Des"],
  [/\b(b ?el ?ed|bachelor of elementary education)\b/i, "B.Ed"],
  [/\b(b ?ed|bachelor of education)\b/i, "B.Ed"],
  [/\b(m ?ed|master of education)\b/i, "M.Ed"],
  [/\b(b ?p ?ed|bachelor of physical education( and sports)?)\b/i, "B.P.Ed"],
  [/\b(m ?p ?ed|master of physical education)\b/i, "M.P.Ed"],
  [/\bbachelor of interior design\b/i, "B.Des"],
  [/\b(bfa|bachelor of fine arts?)\b/i, "BFA"],
  [/\b(mfa|master of fine arts?)\b/i, "MFA"],
  [/\b(bpa|bachelor of performing arts?)\b/i, "BPA"],
  [/\b(mpa|master of performing arts?)\b/i, "MPA"],
  [/\b(bpt|bachelor of physiotherapy)\b/i, "BPT"],
  [/\b(mpt|master of physiotherapy)\b/i, "MPT"],
  [/\b(bhm|bhmct|bachelor of hotel management)\b/i, "BHM / BHMCT"],
  [/\b(b ?voc|bachelor of vocation)\b/i, "B.Voc"],
  [/\b(bsw|bachelor of social work)\b/i, "BSW"],
  [/\b(msw|master of social work)\b/i, "MSW"],
  [/\b(ph ?d|doctor of philosophy)\b/i, "Ph.D."],
  [/\b(ba|bachelor of arts)\b/i, "BA"],
  [/\b(ma|master of arts)\b/i, "MA"],
  [/\bdiploma\b/i, "Diploma"],
];

const normalizeDegreeSearch = (value: string) => value
  .replace(/\./g, "")
  .replace(/[()/_:-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const COURSE_TOKEN_CASE: Record<string, string> = {
  ba: "BA", ma: "MA", bba: "BBA", mba: "MBA", pgdm: "PGDM", bca: "BCA", mca: "MCA",
  bcom: "B.Com", mcom: "M.Com", bsc: "B.Sc.", msc: "M.Sc.", btech: "B.Tech", mtech: "M.Tech",
  be: "B.E.", me: "M.E.", mbbs: "MBBS", bds: "BDS", bpharm: "B.Pharm", mpharm: "M.Pharm",
  llb: "LL.B.", llm: "LL.M.", barch: "B.Arch", march: "M.Arch", bdes: "B.Des", mdes: "M.Des",
  bed: "B.Ed", beled: "B.El.Ed", med: "M.Ed", bped: "B.P.Ed", mped: "M.P.Ed", bfa: "BFA", mfa: "MFA",
  bpa: "BPA", mpa: "MPA", bpt: "BPT", mpt: "MPT", bhm: "BHM",
  bhmct: "BHMCT", bvoc: "B.Voc", bsw: "BSW", msw: "MSW", phd: "Ph.D.", cse: "CSE", ai: "AI",
  ml: "ML", it: "IT", ug: "UG", pg: "PG",
  engg: "Engineering",
};
const LOWERCASE_WORDS = new Set(["and", "of", "in", "for", "with", "to", "at", "by"]);

export function normalizeCourseDisplayName(value: string) {
  const words = value.trim().replace(/&{2,}/g, "&").replace(/\s*&\s*/g, " & ").replace(/\s+/g, " ").split(" ");
  return words.map((word, index) => {
    const edge = word.match(/^([^a-z0-9]*)(.*?)([^a-z0-9]*)$/i);
    const prefix = edge?.[1] || "";
    const core = edge?.[2] ?? word;
    const suffix = edge?.[3] || "";
    const token = core.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (COURSE_TOKEN_CASE[token]) {
      const canonical = COURSE_TOKEN_CASE[token];
      return `${prefix}${canonical}${canonical.endsWith(".") ? suffix.replace(/\./g, "") : suffix}`;
    }
    if (index > 0 && LOWERCASE_WORDS.has(core.toLowerCase())) return `${prefix}${core.toLowerCase()}${suffix}`;
    if (/^[A-Z0-9]{2,}$/.test(core)) return `${prefix}${core}${suffix}`;
    return `${prefix}${core.charAt(0).toUpperCase()}${core.slice(1).toLowerCase()}${suffix}`;
  }).join(" ");
}

const canonicalGroup = (value: string) => {
  const direct = COURSE_GROUP_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  if (direct) return direct;
  return GROUP_RULES.find(([pattern]) => pattern.test(normalizeDegreeSearch(value)))?.[1] || normalizeCourseDisplayName(value);
};

export function inferCourseGroup(row: CollegeFeeRow) {
  if (row.course_group?.trim()) return canonicalGroup(row.course_group);
  const source = normalizeDegreeSearch(`${row.course_name || ""} ${row.course_slug || ""}`.replaceAll("-", " "));
  return GROUP_RULES.find(([pattern]) => pattern.test(source))?.[1]
    || (row.course_name?.trim() ? normalizeCourseDisplayName(row.course_name) : "Other Programs");
}

export function inferCourseSpecialization(row: CollegeFeeRow) {
  const name = row.course_name?.trim() || "Program details";
  if (row.specialization?.trim() && row.specialization.trim().toLowerCase() !== name.toLowerCase()) {
    return normalizeCourseDisplayName(row.specialization);
  }
  const group = inferCourseGroup(row);
  const normalizedName = normalizeDegreeSearch(name);
  const matchedRule = GROUP_RULES.find(([pattern, label]) => label === group && pattern.test(normalizedName));
  const withoutGroup = (matchedRule ? normalizedName.replace(matchedRule[0], "") : normalizedName)
    .replace(/^\s*(hons|honours)\s*/i, "")
    .replace(/^\s*in\s+/i, "")
    .replace(/^\s*-\s*/, "")
    .replace(/^\s*:\s*/, "")
    .replace(/^\s*\/\s*/, "")
    .replace(/^\s*\(\s*/, "")
    .replace(/\s*\)\s*$/, "")
    .trim();
  return withoutGroup && withoutGroup.toLowerCase() !== normalizeDegreeSearch(group).toLowerCase()
    ? normalizeCourseDisplayName(withoutGroup)
    : "General";
}

export function inferAcademicLevel(row: CollegeFeeRow) {
  const explicit = row.academic_level?.trim().toLowerCase();
  if (explicit) {
    if (["ug", "undergraduate", "under graduate", "bachelor"].includes(explicit)) return "UG";
    if (["pg", "postgraduate", "post graduate", "master"].includes(explicit)) return "PG";
    if (["diploma", "diploma / certificate"].includes(explicit)) return "Diploma";
    if (["doctoral", "doctorate", "phd", "ph.d."].includes(explicit)) return "Doctoral";
    if (explicit === "certificate") return "Certificate";
    if (explicit === "other") return "Other";
    return normalizeCourseDisplayName(row.academic_level!.trim());
  }

  const group = inferCourseGroup(row);
  if (group === "Diploma") return "Diploma";
  if (group === "Ph.D.") return "Doctoral";
  if (/^(M\.|M[A-Z]|MBA|PGDM|LL\.M)/.test(group)) return "PG";
  if (/^(B\.|B[A-Z]|LL\.B|MBBS|BDS)/.test(group)) return "UG";

  const source = `${row.course_name || ""} ${row.course_slug || ""}`;
  if (/\b(certificate|certification)\b/i.test(source)) return "Certificate";
  if (/\b(postgraduate|post graduate|pg|master|llm|md|ms)\b/i.test(source)) return "PG";
  if (/\b(undergraduate|under graduate|ug|bachelor|llb|mbbs|bds)\b/i.test(source)) return "UG";
  return "Other";
}

export function formatFeePeriod(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "";
  if (["annual", "annually", "year", "yearly", "per year"].includes(normalized)) return "per year";
  if (["semester", "semester-wise", "per semester"].includes(normalized)) return "per semester";
  if (["month", "monthly", "per month"].includes(normalized)) return "per month";
  if (["total", "total course", "full course", "one time", "one-time"].includes(normalized)) return "total course";
  return normalized.startsWith("per ") ? normalized : `per ${normalized}`;
}

export function groupCollegeFees(rows: CollegeFeeRow[], search = ""): CollegeFeeGroup[] {
  const query = search.trim().toLowerCase();
  const groups = new Map<string, CollegeFeeGroup>();

  for (const row of rows) {
    const label = inferCourseGroup(row);
    const specialization = inferCourseSpecialization(row);
    const searchable = [label, specialization, row.course_name, row.course_slug, row.fee_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (query && !searchable.includes(query)) continue;

    const key = label.toLowerCase();
    const amount = Number(row.fee_amount);
    const validAmount = Number.isFinite(amount) && amount > 0 ? amount : null;
    const current = groups.get(key) || {
      key,
      label,
      entries: [],
      specializationCount: 0,
      lowFee: null,
      highFee: null,
      feeTypes: [],
    };
    current.entries.push(row);
    if (validAmount !== null) {
      current.lowFee = current.lowFee === null ? validAmount : Math.min(current.lowFee, validAmount);
      current.highFee = current.highFee === null ? validAmount : Math.max(current.highFee, validAmount);
    }
    if (row.fee_type?.trim() && !current.feeTypes.includes(row.fee_type.trim())) current.feeTypes.push(row.fee_type.trim());
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      specializationCount: new Set(group.entries.map(inferCourseSpecialization).map((value) => value.toLowerCase())).size,
      entries: [...group.entries].sort((a, b) => inferCourseSpecialization(a).localeCompare(inferCourseSpecialization(b))),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const LEVEL_ORDER = new Map(ACADEMIC_LEVEL_OPTIONS.map((level, index) => [level, index]));

export function groupCollegeFeesByLevel(rows: CollegeFeeRow[], search = ""): CollegeFeeLevel[] {
  const levels = new Map<string, CollegeFeeRow[]>();
  for (const row of rows) {
    const level = inferAcademicLevel(row);
    levels.set(level, [...(levels.get(level) || []), row]);
  }

  return [...levels.entries()]
    .map(([label, levelRows]) => {
      const groups = groupCollegeFees(levelRows, search);
      const visibleRows = groups.flatMap((group) => group.entries);
      const validFees = visibleRows
        .map((row) => Number(row.fee_amount))
        .filter((amount) => Number.isFinite(amount) && amount > 0);
      const uniqueCourses = new Set(visibleRows.map((row) => [
        row.course_slug?.trim() || row.course_name || "course",
        inferCourseSpecialization(row),
      ].join("|").toLowerCase()));
      return {
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label,
        groups,
        courseCount: uniqueCourses.size,
        lowFee: validFees.length ? Math.min(...validFees) : null,
        highFee: validFees.length ? Math.max(...validFees) : null,
      };
    })
    .filter((level) => level.groups.length > 0)
    .sort((a, b) => (LEVEL_ORDER.get(a.label as typeof ACADEMIC_LEVEL_OPTIONS[number]) ?? 99)
      - (LEVEL_ORDER.get(b.label as typeof ACADEMIC_LEVEL_OPTIONS[number]) ?? 99));
}

export function formatIndianFee(amount: number | null) {
  if (amount === null) return "Not published";
  if (amount >= 10_000_000) return `₹${Number((amount / 10_000_000).toFixed(1))} Cr`;
  if (amount >= 100_000) return `₹${Number((amount / 100_000).toFixed(1))} L`;
  if (amount >= 1_000) return `₹${Number((amount / 1_000).toFixed(1))} K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatFeeRange(group: Pick<CollegeFeeGroup, "lowFee" | "highFee">) {
  if (group.lowFee === null || group.highFee === null) return "Check official fee notice";
  if (group.lowFee === group.highFee) return formatIndianFee(group.lowFee);
  return `${formatIndianFee(group.lowFee)} - ${formatIndianFee(group.highFee)}`;
}
