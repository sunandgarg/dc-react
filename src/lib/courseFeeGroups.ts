export type CollegeFeeRow = {
  id?: string;
  course_slug?: string | null;
  course_name?: string | null;
  course_group?: string | null;
  specialization?: string | null;
  fee_amount?: number | string | null;
  fee_type?: string | null;
  year?: string | null;
};

export type CollegeFeeGroup = {
  key: string;
  label: string;
  entries: CollegeFeeRow[];
  specializationCount: number;
  lowFee: number | null;
  highFee: number | null;
  feeTypes: string[];
};

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
  "Ph.D.",
  "Diploma",
];

const GROUP_RULES: Array<[RegExp, string]> = [
  [/\b(b\.?\s*e\.?|b\.?\s*tech|bachelor of (engineering|technology))\b/i, "B.E. / B.Tech"],
  [/\b(m\.?\s*e\.?|m\.?\s*tech|master of (engineering|technology))\b/i, "M.E. / M.Tech"],
  [/\b(mba|pgdm|master of business administration)\b/i, "MBA / PGDM"],
  [/\b(bba|bachelor of business administration)\b/i, "BBA"],
  [/\b(bca|bachelor of computer applications?)\b/i, "BCA"],
  [/\b(mca|master of computer applications?)\b/i, "MCA"],
  [/\b(b\.?\s*com|bachelor of commerce)\b/i, "B.Com"],
  [/\b(m\.?\s*com|master of commerce)\b/i, "M.Com"],
  [/\b(b\.?\s*sc|bachelor of science)\b/i, "B.Sc."],
  [/\b(m\.?\s*sc|master of science)\b/i, "M.Sc."],
  [/\b(mbbs|bachelor of medicine)\b/i, "MBBS"],
  [/\b(bds|bachelor of dental surgery)\b/i, "BDS"],
  [/\b(b\.?\s*pharm|bachelor of pharmacy)\b/i, "B.Pharm"],
  [/\b(m\.?\s*pharm|master of pharmacy)\b/i, "M.Pharm"],
  [/\b(ll\.?\s*b|bachelor of laws?)\b/i, "LL.B."],
  [/\b(ll\.?\s*m|master of laws?)\b/i, "LL.M."],
  [/\b(b\.?\s*arch|bachelor of architecture)\b/i, "B.Arch"],
  [/\b(m\.?\s*arch|master of architecture)\b/i, "M.Arch"],
  [/\b(ph\.?\s*d|doctor of philosophy)\b/i, "Ph.D."],
  [/\b(ba|bachelor of arts)\b/i, "BA"],
  [/\b(ma|master of arts)\b/i, "MA"],
  [/\bdiploma\b/i, "Diploma"],
];

const canonicalGroup = (value: string) => {
  const direct = COURSE_GROUP_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  if (direct) return direct;
  return GROUP_RULES.find(([pattern]) => pattern.test(value))?.[1] || value.trim();
};

export function inferCourseGroup(row: CollegeFeeRow) {
  if (row.course_group?.trim()) return canonicalGroup(row.course_group);
  const source = `${row.course_name || ""} ${row.course_slug || ""}`.replaceAll("-", " ");
  return GROUP_RULES.find(([pattern]) => pattern.test(source))?.[1] || row.course_name?.trim() || "Other programs";
}

export function inferCourseSpecialization(row: CollegeFeeRow) {
  if (row.specialization?.trim()) return row.specialization.trim();
  const name = row.course_name?.trim() || "Program details";
  const group = inferCourseGroup(row);
  const withoutGroup = name
    .replace(/\b(b\.?\s*e\.?|b\.?\s*tech|bachelor of (engineering|technology))\b/ig, "")
    .replace(/\b(m\.?\s*e\.?|m\.?\s*tech|master of (engineering|technology))\b/ig, "")
    .replace(/\b(mba|pgdm|master of business administration)\b/ig, "")
    .replace(/^\s*in\s+/i, "")
    .replace(/^\s*-\s*/, "")
    .replace(/^\s*:\s*/, "")
    .replace(/^\s*\/\s*/, "")
    .replace(/^\s*\(\s*/, "")
    .replace(/\s*\)\s*$/, "")
    .trim();
  return withoutGroup && withoutGroup.toLowerCase() !== group.toLowerCase() ? withoutGroup : name;
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
