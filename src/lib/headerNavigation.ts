import { buildCollegeHref, buildCourseHref, buildExamHref } from "@/lib/entityUrls";
import { TOOLS_REGISTRY } from "@/lib/toolsRegistry";

export interface HeaderLink { label: string; href: string; image?: string | null }
export interface HeaderGroup { title: string; items: HeaderLink[] }
export interface HeaderSection { key: string; label: string; href?: string; groups?: HeaderGroup[] }
export interface HeaderCatalogItem {
  name: string; slug: string; short_id?: number | null; category?: string | null;
  state?: string | null; logo?: string | null; is_top_exam?: boolean | null;
}
export interface HeaderCatalog { colleges: HeaderCatalogItem[]; courses: HeaderCatalogItem[]; exams: HeaderCatalogItem[] }

const streams = ["Engineering", "Management", "Medical", "Science", "Design", "Law", "Arts & Humanities", "Education"];
const filterHref = (path: string, key: string, values: string | string[]) => {
  const params = new URLSearchParams();
  (Array.isArray(values) ? values : [values]).forEach((value) => params.append(key, value));
  return `${path}?${params.toString()}`;
};
const byStream = (path: string): HeaderGroup => ({
  title: "By Stream", items: streams.map((label) => ({ label, href: filterHref(path, "stream", label) })),
});

export function buildHeaderNavigation(data?: HeaderCatalog): HeaderSection[] {
  const states = [...new Set((data?.colleges || []).map((item) => item.state).filter(Boolean))] as string[];
  const stateNames = states.length ? states.sort().slice(0, 12) : ["Delhi NCR", "Maharashtra", "Karnataka", "Tamil Nadu", "Uttar Pradesh", "Punjab", "Haryana", "Rajasthan"];
  return [
    { key: "colleges", label: "Colleges", href: "/colleges", groups: [
      byStream("/colleges"),
      { title: "Popular Colleges", items: (data?.colleges || []).slice(0, 16).map((item) => ({ label: item.name, href: buildCollegeHref(item), image: item.logo })).concat([{ label: "Browse all colleges", href: "/colleges", image: null }]) },
      { title: "By Location", items: stateNames.map((label) => ({ label, href: filterHref("/colleges", "state", label) })) },
      { title: "College Type", items: [
        { label: "Government & Public", href: filterHref("/colleges", "type", ["Government", "Public", "Public Institute", "Public (Autonomous)", "Public Institute (Autonomous)", "State University", "State Agricultural University", "Open University"]) },
        { label: "Private Colleges", href: filterHref("/colleges", "type", ["Private", "Private Institute", "Private University", "Private (Autonomous)", "Private Institute (Autonomous)"]) },
        { label: "Deemed Universities", href: filterHref("/colleges", "type", ["Deemed", "Deemed University", "Deemed To Be University"]) },
        { label: "Autonomous Colleges", href: filterHref("/colleges", "type", ["Private (Autonomous)", "Public (Autonomous)", "Autonomous University", "Private Institute (Autonomous)", "Public Institute (Autonomous)"]) },
      ] },
    ] },
    { key: "courses", label: "Courses", href: "/courses", groups: [
      byStream("/courses"),
      { title: "Popular Courses", items: (data?.courses || []).slice(0, 16).map((item) => ({ label: item.name, href: buildCourseHref(item) })).concat([{ label: "Browse all courses", href: "/courses" }]) },
      { title: "By Level", items: [
        { label: "Undergraduate (UG)", href: "/courses?level=Undergraduate" },
        { label: "Postgraduate (PG)", href: "/courses?level=Postgraduate" },
        { label: "Certificate", href: "/courses?level=Certificate" },
        { label: "Doctorate (PhD)", href: "/courses?level=Doctoral" },
      ] },
      { title: "Study Mode", items: [
        { label: "Full-Time", href: "/courses?mode=Full+Time" },
        { label: "Online", href: "/courses?mode=Online" },
        { label: "Self-Paced", href: "/courses?mode=Self-Paced" },
      ] },
    ] },
    { key: "exams", label: "Exams", href: "/exams", groups: [
      byStream("/exams"),
      { title: "Popular Exams", items: (data?.exams || []).slice(0, 16).map((item) => ({ label: item.name, href: buildExamHref(item), image: item.logo })).concat([{ label: "Browse all exams", href: "/exams", image: null }]) },
      { title: "By Level", items: [
        { label: "Undergraduate (UG)", href: "/exams?level=UG" },
        { label: "Postgraduate (PG)", href: "/exams?level=PG" },
        { label: "After Class 12", href: "/exams?level=12th" },
        { label: "After Class 10", href: "/exams?level=10th" },
      ] },
      { title: "Exam Categories", items: ["Entrance", "Board", "Sarkari", "Study Abroad"].map((label) => ({ label, href: filterHref("/exams", "category", label) })) },
    ] },
    { key: "scholarships", label: "Scholarships", href: "/scholarships", groups: [
      { title: "By Category", items: ["Merit", "Government", "Corporate", "NGO"].map((label) => ({ label, href: filterHref("/scholarships", "category", label) })) },
      { title: "Explore Scholarships", items: [
        { label: "Undergraduate (UG)", href: "/scholarships?level=UG" },
        { label: "All scholarships", href: "/scholarships" },
      ] },
    ] },
    { key: "news", label: "News", href: "/news" },
    { key: "about", label: "About Us", href: "/about-us" },
    { key: "more", label: "More", groups: [
      { title: "CAT Universe", items: [
        { label: "Explore CAT Universe", href: "/cat-universe" },
        { label: "Free CAT Preparation Kit", href: "/cat-universe/cat-2026-preparation-kit" },
        { label: "AI Interview Practice", href: "/cat-universe/ai-interview-practice" },
        { label: "AI CAT Coach", href: "/cat-universe/ai-coach" },
        ...[ ["CAT Score Calculator", "cat-score-calculator"], ["XAT Score Calculator", "xat-score-calculator"], ["CMAT Score Calculator", "cmat-score-calculator"], ["SOP, Score and WAT Desk", "sop-exam-score-wat"], ["CAT Previous Papers", "cat-previous-year-papers"], ["XAT Previous Papers", "xat-previous-year-papers"], ["MAT Previous Papers", "mat-previous-year-papers"], ["GMAT Previous Papers", "gmat-previous-year-papers"], ["IIM Call Predictor", "iim-call-predictor"], ["Interview Calls and Converts", "interview-calls-converts"], ["Mock Interviews and Dockets", "mock-interview-and-dockets"], ["CAT College Cut-offs", "cat-based-college-cutoffs"], ["NMAT College Cut-offs", "nmat-based-college-cutoffs"], ["XAT College Cut-offs", "xat-based-college-cutoffs"] ].map(([label, slug]) => ({ label, href: `/cat-universe/${slug}` })),
      ] },
      { title: "Study Material", items: [
        { label: "All Study Material", href: "/study-material" },
        ...[12, 11, 10, 9, 8].map((value) => ({ label: `Class ${value}`, href: `/study-material/class-${value}` })),
        ...[["CBSE", "cbse"], ["ICSE", "icse"], ["State Board", "state"], ["Bihar Board", "bihar-board"]].map(([label, slug]) => ({ label, href: `/study-material?board=${slug}` })),
        { label: "College Notes and Papers", href: "/college-study-material" },
        { label: "Sample Papers", href: "/news/tag/sample-papers" },
        { label: "Date Sheets", href: "/news/tag/date-sheet" },
        { label: "Chapter Notes", href: "/news/tag/notes" },
        { label: "Previous Year Papers", href: "/news/tag/previous-papers" },
      ] },
      { title: "Student Tools", items: [
        { label: "Ask Diya AI", href: "#ask-diya" },
        ...TOOLS_REGISTRY.map((tool) => ({ label: tool.slug === "lock-target" ? "Target with AI" : tool.title, href: `/tools/${tool.slug}` })),
        { label: "All Student Tools", href: "/tools" },
      ] },
      { title: "Guidance & Careers", items: [
        { label: "College Predictor", href: "/college-predictor" },
        { label: "Eligibility Checker", href: "/eligibility-checker" },
        { label: "Compare Colleges", href: "/compare" },
        { label: "Exam Calendar", href: "/exam-calendar" },
        { label: "Dream College Roadmap", href: "/lock-target" },
        { label: "My Targets", href: "/target-dashboard" },
        { label: "Career Guides", href: "/careers" },
        { label: "Jobs & Vacancies", href: "/vacancies" },
        { label: "Premium Programs", href: "/premium-programs" },
        { label: "Resources", href: "/resources" },
        { label: "Refer & Earn", href: "/dashboard/refer" },
      ] },
    ] },
  ];
}
