// Curated popular and emerging programmes, not measured search-volume rankings.
// Every slug was matched to an active course in the public catalogue.
// Research and review notes: docs/homepage-course-curation-2026-09-28.md.
export const HOMEPAGE_COURSE_PICKS: Record<string, { slug: string; label: string }[]> = {
  Engineering: [
    { slug: "btech-computer-science", label: "B.Tech Computer Science" },
    { slug: "b-tech-artificial-intelligence", label: "B.Tech Artificial Intelligence" },
    { slug: "b-tech-data-science", label: "B.Tech Data Science" },
    { slug: "btech-it", label: "B.Tech Information Technology" },
    { slug: "btech-electronics-and-communications-engineering", label: "B.Tech Electronics & Communication" },
  ],
  Management: [
    { slug: "master-of-business-administration-mba", label: "MBA" },
    { slug: "mba-business-analytics", label: "MBA Business Analytics" },
    { slug: "bachelor-of-business-administration-bba", label: "BBA" },
    { slug: "mba-finance-management", label: "MBA Finance" },
    { slug: "mba-digital-marketing", label: "MBA Digital Marketing" },
  ],
  "Commerce and Banking": [
    { slug: "b-com-honours", label: "B.Com Honours" },
    { slug: "bachelor-of-commerce", label: "B.Com" },
    { slug: "chartered-accountancy-ca", label: "Chartered Accountancy (CA)" },
    { slug: "company-secretary", label: "Company Secretary (CS)" },
    { slug: "b-com-banking-and-insurance", label: "B.Com Banking & Insurance" },
  ],
  Medical: [
    { slug: "mbbs", label: "MBBS" },
    { slug: "bsc-nursing", label: "B.Sc Nursing" },
    { slug: "bachelor-of-physiotherapy-bpt", label: "Bachelor of Physiotherapy (BPT)" },
    { slug: "bds", label: "BDS" },
    { slug: "bsc-medical-laboratory-technology-bsc-mlt", label: "B.Sc Medical Laboratory Technology" },
  ],
  Science: [
    { slug: "bsc-computer-science", label: "B.Sc Computer Science" },
    { slug: "bsc-biotechnology", label: "B.Sc Biotechnology" },
    { slug: "msc-data-science", label: "M.Sc Data Science" },
    { slug: "bsc-forensic-science", label: "B.Sc Forensic Science" },
    { slug: "bsc-statistics", label: "B.Sc Statistics" },
  ],
  "Hotel Management": [
    { slug: "bsc-hospitality-and-hotel-administration", label: "B.Sc Hospitality & Hotel Administration" },
    { slug: "bachelor-of-hotel-management-bhm", label: "Bachelor of Hotel Management (BHM)" },
    { slug: "bachelor-of-hotel-management-and-catering-technology-bhmct", label: "Hotel Management & Catering Technology" },
    { slug: "bachelor-of-catering-technology-and-culinary-arts", label: "Catering Technology & Culinary Arts" },
    { slug: "bttm", label: "Tourism & Travel Management" },
  ],
  "Information Technology": [
    { slug: "bca", label: "BCA" },
    { slug: "mca", label: "MCA" },
    { slug: "bsc-it", label: "B.Sc Information Technology" },
    { slug: "bsc-computer-science", label: "B.Sc Computer Science" },
    { slug: "cyber-security-and-ethical-hacking", label: "Cybersecurity & Ethical Hacking" },
  ],
  "Arts & Humanities": [
    { slug: "ba-psychology", label: "BA Psychology" },
    { slug: "ba-hons-economics", label: "BA Economics Honours" },
    { slug: "bachelor-of-journalism-and-mass-communication-bjmc", label: "Journalism & Mass Communication (BJMC)" },
    { slug: "ba-journalism", label: "BA Journalism" },
    { slug: "ma-public-policy", label: "MA Public Policy" },
  ],
  Agriculture: [
    { slug: "bsc-agriculture", label: "B.Sc Agriculture" },
    { slug: "bsc-horticulture", label: "B.Sc Horticulture" },
    { slug: "btech-food-technology", label: "B.Tech Food Technology" },
    { slug: "msc-agriculture", label: "M.Sc Agriculture" },
    { slug: "mba-agri-business-management", label: "MBA Agribusiness Management" },
  ],
  Law: [
    { slug: "ba-llb", label: "BA LLB" },
    { slug: "bba-llb", label: "BBA LLB" },
    { slug: "bachelor-of-law", label: "LLB" },
    { slug: "llm", label: "LLM" },
    { slug: "b-com-b-com-llb-bachelors-of-commerce-and-bachelor-of-legislative-law", label: "B.Com LLB" },
  ],
  Pharmacy: [
    { slug: "b-pharma", label: "B.Pharm" },
    { slug: "diploma-in-pharmacy-dpharma", label: "D.Pharm" },
    { slug: "pharm-d-doctor-of-pharmacy", label: "Pharm.D" },
    { slug: "mpharm-in-pharmaceutics", label: "M.Pharm Pharmaceutics" },
    { slug: "mpharm-pharmaceutical-analysis", label: "M.Pharm Pharmaceutical Analysis" },
  ],
  Education: [
    { slug: "bed", label: "B.Ed" },
    { slug: "diploma-in-elementary-education", label: "D.El.Ed" },
    { slug: "bachelor-of-elementary-education-b-el-ed", label: "B.El.Ed" },
    { slug: "m-ed", label: "M.Ed" },
    { slug: "bed-in-special-education", label: "B.Ed Special Education" },
  ],
  Design: [
    { slug: "bdes", label: "B.Des" },
    { slug: "bdes-ux-design", label: "B.Des UX Design" },
    { slug: "bdes-product-design", label: "B.Des Product Design" },
    { slug: "b-des-in-fashion-communication", label: "B.Des Fashion Communication" },
    { slug: "bdes-graphic-design", label: "B.Des Graphic Design" },
  ],
};

export const FEATURED_COURSE_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(HOMEPAGE_COURSE_PICKS).flat().map(({ slug, label }) => [slug, label]),
);
