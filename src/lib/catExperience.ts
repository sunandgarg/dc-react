import { functionUrl } from "@/lib/backendMode";

export const CAT_ACCESS_KEY = "dc_cat_2026_access_v1";

export const CAT_KIT_RESOURCES = [
  { group: "Actual CAT papers", title: "CAT 2023 Slot 1 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2023 Slot 2 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2023 Slot 3 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2024 Slot 1 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2024 Slot 2 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2024 Slot 3 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2025 Slot 1 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2025 Slot 2 with solutions", detail: "Full paper and worked solution" },
  { group: "Actual CAT papers", title: "CAT 2025 Slot 3 with solutions", detail: "Full paper and worked solution" },
  { group: "Preparation system", title: "CAT 2026 preparation roadmap", detail: "A structured plan for first-time aspirants" },
  { group: "Preparation system", title: "CAT 2026 mock-test psychology", detail: "Decision making under timed pressure" },
  { group: "Practice banks", title: "VARC practice questions", detail: "Reading, reasoning and verbal drills" },
  { group: "Practice banks", title: "DILR practice questions", detail: "Selection and set-solving drills" },
  { group: "Practice banks", title: "QA practice questions", detail: "Mixed quantitative practice" },
  { group: "Short playbooks", title: "Quant short tricks", detail: "Speed methods with sensible checks" },
  { group: "Short playbooks", title: "VARC mastery playbook", detail: "A repeatable reading and review method" },
] as const;

export type InterviewProfile = {
  target: string;
  focus: "general" | "academics" | "work" | "current_affairs";
  difficulty: "foundation" | "standard" | "pressure";
};

export type InterviewScores = {
  clarity: number;
  structure: number;
  relevance: number;
  evidence: number;
  confidence: number;
};

export type InterviewFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  better_answer_shape: string;
  scores: InterviewScores;
};

export type CoachDiagnostic = {
  target_percentile: number;
  hours_per_day: number;
  days_to_exam: number;
  current_level: "starting" | "building" | "mock-ready";
  weakest_section: "VARC" | "DILR" | "QA";
  constraints: string;
};

export type CoachPlan = {
  headline: string;
  strategy: string;
  section_goals: Array<{ section: string; goal: string; minutes: number }>;
  today: string[];
  week: string[];
  checkpoints: string[];
};

export function readCatAccess() {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(CAT_ACCESS_KEY) || ""; } catch { return ""; }
}

export function saveCatAccess(leadId?: string) {
  if (!leadId || typeof window === "undefined") return;
  try { window.localStorage.setItem(CAT_ACCESS_KEY, leadId); } catch { /* storage is optional */ }
}

export async function catExperience<T>(action: string, leadId: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(functionUrl("cat-experience"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, lead_id: leadId, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || "CAT experience is temporarily unavailable");
  return body as T;
}

export function averageInterviewScore(scores: InterviewScores[]) {
  if (!scores.length) return 0;
  const total = scores.reduce((sum, item) => sum + Object.values(item).reduce((part, value) => part + value, 0) / 5, 0);
  return Math.round((total / scores.length) * 10) / 10;
}
