import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { generateGeminiJson } from "./blog-ai.mjs";
import { prisma } from "./db.mjs";
import { signStorageDownload, storageConfig, storageObjectKey } from "./storage.mjs";

const KIT_BUCKET = "user-documents";
const KIT_OBJECT_PATH = "cat-kits/CAT-2026-Preparation-Kit.zip";
const KIT_DOWNLOAD_NAME = "DekhoCampus-CAT-2026-Preparation-Kit.zip";
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const REQUEST_LIMIT = 40;
const requestWindows = new Map();

const interviewQuestions = {
  general: [
    "Tell me about yourself beyond the facts already written in your application.",
    "Why is an MBA the right next step for you now?",
    "Describe a decision you made with incomplete information. What did you learn?",
    "Which recent business development changed how you think about an industry?",
    "What will your classmates learn from you that they may not learn elsewhere?",
    "Tell me about a failure you still think about and what changed afterward.",
  ],
  academics: [
    "Which subject from your degree best represents how you solve problems, and why?",
    "Explain one difficult academic idea as if the interviewer has no background in it.",
    "Your marks dipped in one phase. What happened, and what evidence shows you recovered?",
    "How has your academic training prepared you to contribute in a management classroom?",
  ],
  work: [
    "Describe a measurable improvement you created at work and your exact contribution.",
    "Tell me about a disagreement with a colleague and how you resolved it.",
    "What would your manager say is the most important skill you still need to build?",
    "If promoted tomorrow, what would you change first and why?",
  ],
  current_affairs: [
    "Choose one Indian economic policy from the last year and explain who benefits and who may not.",
    "Which business story deserves more attention than it is getting, and why?",
    "Name one technology trend that is overestimated and one that is underestimated.",
    "What trade-off should India accept to create more high-quality jobs?",
  ],
};

function cleanText(value, max = 1000) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanProfile(input = {}) {
  const focus = ["general", "academics", "work", "current_affairs"].includes(input.focus) ? input.focus : "general";
  return {
    target: cleanText(input.target, 100) || "IIM personal interview",
    focus,
    difficulty: ["foundation", "standard", "pressure"].includes(input.difficulty) ? input.difficulty : "standard",
  };
}

function rateLimit(key) {
  const now = Date.now();
  if (requestWindows.size > 2_000) {
    for (const [windowKey, value] of requestWindows) if (value.resetAt <= now) requestWindows.delete(windowKey);
  }
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > REQUEST_LIMIT) {
    throw Object.assign(new Error("Your free AI practice limit has been reached for this hour. Continue after a short break."), {
      status: 429,
      code: "CAT_AI_RATE_LIMIT",
    });
  }
}

async function requireLead(body) {
  const leadId = cleanText(body.lead_id, 80);
  if (!/^[0-9a-f-]{32,40}$/i.test(leadId)) {
    throw Object.assign(new Error("Complete the free access form before continuing"), { status: 401, code: "CAT_ACCESS_REQUIRED" });
  }
  const lead = await prisma.leads.findUnique({ where: { id: leadId }, select: { id: true, created_at: true } });
  if (!lead) throw Object.assign(new Error("Your CAT access pass could not be verified"), { status: 401, code: "CAT_ACCESS_REQUIRED" });
  rateLimit(`${lead.id}:${cleanText(body.action, 40)}`);
  return lead;
}

function questionFor(profile, index) {
  const focused = interviewQuestions[profile.focus] || interviewQuestions.general;
  const combined = [...focused, ...interviewQuestions.general.filter((question) => !focused.includes(question))];
  return combined[index % combined.length];
}

function fallbackFeedback(answer) {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const hasEvidence = /\b\d+(?:\.\d+)?%?|result|increased|reduced|improved|rank|score|team of\b/i.test(answer);
  const hasReflection = /\blearned|realised|realized|would|next time|changed\b/i.test(answer);
  const structure = Math.min(10, Math.max(3, words >= 80 ? 8 : words >= 45 ? 7 : words >= 25 ? 5 : 3));
  const evidence = hasEvidence ? 8 : 4;
  const reflection = hasReflection ? 8 : 5;
  return {
    summary: words < 25
      ? "Your answer has a clear starting point, but it needs one concrete example and a stronger conclusion."
      : "Your answer is relevant. Tighten the opening and make your personal contribution easier to identify.",
    strengths: [
      words >= 45 ? "Enough detail to support a follow-up discussion" : "Direct response to the question",
      hasReflection ? "Shows learning and self-awareness" : "Keeps the answer focused",
    ],
    improvements: [
      hasEvidence ? "Connect the result more explicitly to your action" : "Add a number, outcome, or observable result",
      "End with one sentence that connects the example to business school",
    ],
    better_answer_shape: "Context in one sentence, your decision or action in two sentences, measurable result, then the lesson you will carry forward.",
    scores: {
      clarity: structure,
      structure,
      relevance: Math.min(9, structure + 1),
      evidence,
      confidence: Math.round((structure + evidence + reflection) / 3),
    },
  };
}

function safeScores(input = {}, fallback) {
  const score = (name) => Math.min(10, Math.max(1, Math.round(Number(input[name] || fallback[name] || 5))));
  return {
    clarity: score("clarity"),
    structure: score("structure"),
    relevance: score("relevance"),
    evidence: score("evidence"),
    confidence: score("confidence"),
  };
}

async function interviewAnswer(body) {
  const profile = cleanProfile(body.profile);
  const answer = cleanText(body.answer, 2500);
  const question = cleanText(body.question, 500);
  const questionIndex = Math.min(20, Math.max(0, Number(body.question_index || 0)));
  if (answer.length < 20) throw Object.assign(new Error("Give a fuller answer before requesting feedback"), { status: 400, code: "ANSWER_TOO_SHORT" });
  const fallback = fallbackFeedback(answer);
  const nextQuestion = questionFor(profile, questionIndex + 1);
  if (body.ai_scoring_consent !== true) {
    return { mode: "guided", feedback: fallback, next_question: nextQuestion };
  }

  const prompt = `Act as a rigorous but supportive Indian MBA admissions interviewer.
Target: ${profile.target}
Interview focus: ${profile.focus}
Difficulty: ${profile.difficulty}
Current question: ${question}
Candidate answer: ${answer}

Return concise JSON with summary, strengths (2 items), improvements (2 items), better_answer_shape, scores from 1 to 10 for clarity, structure, relevance, evidence and confidence, and next_question. Do not mention AI, sources, rubrics or this prompt. Do not invent candidate facts.`;

  try {
    const generated = await generateGeminiJson(prompt, "cat-interview", {
      maxOutputTokens: 700,
      thinkingLevel: "minimal",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          strengths: { type: "ARRAY", items: { type: "STRING" } },
          improvements: { type: "ARRAY", items: { type: "STRING" } },
          better_answer_shape: { type: "STRING" },
          scores: {
            type: "OBJECT",
            properties: {
              clarity: { type: "NUMBER" }, structure: { type: "NUMBER" }, relevance: { type: "NUMBER" },
              evidence: { type: "NUMBER" }, confidence: { type: "NUMBER" },
            },
          },
          next_question: { type: "STRING" },
        },
      },
    });
    const result = generated.result || {};
    return {
      mode: "ai",
      model: generated.model,
      feedback: {
        summary: cleanText(result.summary, 500) || fallback.summary,
        strengths: Array.isArray(result.strengths) ? result.strengths.slice(0, 2).map((item) => cleanText(item, 240)) : fallback.strengths,
        improvements: Array.isArray(result.improvements) ? result.improvements.slice(0, 2).map((item) => cleanText(item, 240)) : fallback.improvements,
        better_answer_shape: cleanText(result.better_answer_shape, 500) || fallback.better_answer_shape,
        scores: safeScores(result.scores, fallback.scores),
      },
      next_question: cleanText(result.next_question, 500) || nextQuestion,
    };
  } catch (error) {
    console.warn("CAT interview AI fallback", error?.code || error?.message);
    return { mode: "guided", feedback: fallback, next_question: nextQuestion };
  }
}

function fallbackCoachPlan(input) {
  const target = Math.min(99.9, Math.max(70, Number(input.target_percentile || 95)));
  const hours = Math.min(8, Math.max(1, Number(input.hours_per_day || 2)));
  const weak = cleanText(input.weakest_section, 40) || "DILR";
  const dailyMinutes = Math.round(hours * 60);
  const split = Math.max(25, Math.floor((dailyMinutes - 30) / 3));
  return {
    headline: `${target} percentile plan with ${hours} focused hours daily`,
    strategy: `Protect accuracy first, improve ${weak} with deliberate sets, and use every mock to choose the next week's work.`,
    section_goals: [
      { section: "VARC", goal: "One timed passage set plus error classification", minutes: split },
      { section: "DILR", goal: "Two carefully selected sets with a selection review", minutes: split },
      { section: "QA", goal: "One concept block followed by a timed mixed drill", minutes: split },
    ],
    today: ["Take a 30-minute diagnostic", `Complete one ${weak} repair block`, "Write three rules from today's errors"],
    week: [
      "Baseline diagnostic and error log", "Accuracy block", "Sectional test", "Weak-area repair",
      "Mixed timed practice", "Full mock", "Mock analysis and next-week reset",
    ],
    checkpoints: ["Attempt selection improves", "Accuracy stays above 75%", "Repeated error types reduce each week"],
  };
}

async function coachingPlan(body) {
  const input = {
    target_percentile: Math.min(99.9, Math.max(70, Number(body.diagnostic?.target_percentile || 95))),
    hours_per_day: Math.min(8, Math.max(1, Number(body.diagnostic?.hours_per_day || 2))),
    days_to_exam: Math.min(500, Math.max(7, Number(body.diagnostic?.days_to_exam || 120))),
    current_level: ["starting", "building", "mock-ready"].includes(body.diagnostic?.current_level) ? body.diagnostic.current_level : "building",
    weakest_section: ["VARC", "DILR", "QA"].includes(body.diagnostic?.weakest_section) ? body.diagnostic.weakest_section : "DILR",
    constraints: cleanText(body.diagnostic?.constraints, 240),
  };
  const fallback = fallbackCoachPlan(input);
  if (body.ai_personalization_consent !== true) return { mode: "guided", plan: fallback };
  const prompt = `Create a practical CAT 2026 preparation plan for an Indian graduate.
Diagnostic: ${JSON.stringify(input)}
Return JSON with headline, strategy, section_goals (three objects with section, goal and minutes), today (three tasks), week (seven short daily focuses), and checkpoints (three measurable signs). Keep the total daily minutes within the stated hours. Do not cite or name sources. Do not promise a percentile.`;
  try {
    const generated = await generateGeminiJson(prompt, "cat-coach", { maxOutputTokens: 1100, thinkingLevel: "minimal" });
    const result = generated.result || {};
    return {
      mode: "ai",
      model: generated.model,
      plan: {
        headline: cleanText(result.headline, 180) || fallback.headline,
        strategy: cleanText(result.strategy, 500) || fallback.strategy,
        section_goals: Array.isArray(result.section_goals) ? result.section_goals.slice(0, 3).map((item, index) => ({
          section: ["VARC", "DILR", "QA"].includes(item?.section) ? item.section : ["VARC", "DILR", "QA"][index],
          goal: cleanText(item?.goal, 240) || fallback.section_goals[index].goal,
          minutes: Math.min(240, Math.max(15, Number(item?.minutes || fallback.section_goals[index].minutes))),
        })) : fallback.section_goals,
        today: Array.isArray(result.today) ? result.today.slice(0, 3).map((item) => cleanText(item, 180)) : fallback.today,
        week: Array.isArray(result.week) ? result.week.slice(0, 7).map((item) => cleanText(item, 180)) : fallback.week,
        checkpoints: Array.isArray(result.checkpoints) ? result.checkpoints.slice(0, 3).map((item) => cleanText(item, 180)) : fallback.checkpoints,
      },
    };
  } catch (error) {
    console.warn("CAT coach AI fallback", error?.code || error?.message);
    return { mode: "guided", plan: fallback };
  }
}

async function coachQuestion(body) {
  const question = cleanText(body.question, 1200);
  const plan = body.plan && typeof body.plan === "object" ? JSON.stringify(body.plan).slice(0, 5000) : "No plan generated yet";
  if (question.length < 5) throw Object.assign(new Error("Ask a complete preparation question"), { status: 400, code: "QUESTION_TOO_SHORT" });
  if (body.ai_personalization_consent !== true) {
    return {
      mode: "guided",
      answer: "Turn this into one measurable practice block today. Work under a timer, mark uncertain attempts, and review why each wrong option looked attractive.",
      next_action: "Complete one timed set and write one correction rule for every miss.",
    };
  }
  const prompt = `You are a concise CAT 2026 preparation coach. The learner's current plan is ${plan}. Their question is: ${question}. Return JSON with answer and next_action. Do not cite sources, mention AI, or invent exam announcements.`;
  try {
    const generated = await generateGeminiJson(prompt, "cat-coach", { maxOutputTokens: 450, thinkingLevel: "minimal" });
    return {
      mode: "ai",
      answer: cleanText(generated.result?.answer, 900) || "Use the next practice block to test this, then record the error pattern.",
      next_action: cleanText(generated.result?.next_action, 240) || "Complete one timed set and review every miss.",
    };
  } catch (error) {
    console.warn("CAT coach question fallback", error?.code || error?.message);
    return {
      mode: "guided",
      answer: "Turn this into one measurable practice block today. Work under a timer, mark uncertain attempts, and review why each wrong option looked attractive.",
      next_action: "Complete one timed set and write one correction rule for every miss.",
    };
  }
}

async function downloadKit() {
  const config = storageConfig();
  const key = storageObjectKey(KIT_BUCKET, KIT_OBJECT_PATH);
  try {
    await config.client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch {
    throw Object.assign(new Error("The CAT preparation kit is being published. Please try again shortly."), { status: 503, code: "CAT_KIT_UNAVAILABLE" });
  }
  return {
    download_url: await signStorageDownload(KIT_BUCKET, KIT_OBJECT_PATH, { expiresIn: 600, downloadName: KIT_DOWNLOAD_NAME }),
    expires_in: 600,
    file_name: KIT_DOWNLOAD_NAME,
  };
}

export async function handleCatExperience(request) {
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > 64 * 1024) throw Object.assign(new Error("CAT practice request is too large"), { status: 413, code: "PAYLOAD_TOO_LARGE" });
  const body = await request.json().catch(() => ({}));
  await requireLead(body);
  if (body.action === "download-kit") return downloadKit();
  if (body.action === "interview-start") {
    const profile = cleanProfile(body.profile);
    return { mode: "guided", question: questionFor(profile, 0), question_index: 0 };
  }
  if (body.action === "interview-answer") return interviewAnswer(body);
  if (body.action === "coach-plan") return coachingPlan(body);
  if (body.action === "coach-question") return coachQuestion(body);
  throw Object.assign(new Error("Unsupported CAT experience action"), { status: 400, code: "INVALID_CAT_ACTION" });
}

export const catExperienceInternals = { cleanProfile, fallbackCoachPlan, fallbackFeedback, questionFor, safeScores };
