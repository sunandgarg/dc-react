import { useState } from "react";
import { ArrowLeft, Brain, CheckCircle2, ChevronRight, Clock3, GraduationCap, RotateCw, ShieldCheck, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";

/**
 * RIASEC-based career interest psychometric test.
 * The assessment is client-side; the required lead gate runs before questions.
 */

type Trait = "R" | "I" | "A" | "S" | "E" | "C";
type StudentLevel = "class-9" | "class-10" | "class-11" | "class-12" | "graduation";
type Phase = "intro" | "lead" | "test" | "result";

const QUESTIONS: { q: string; t: Trait }[] = [
  { q: "I enjoy fixing or building things with my hands.", t: "R" },
  { q: "I love solving puzzles, equations and figuring out how things work.", t: "I" },
  { q: "I love drawing, music, design, writing or another form of art.", t: "A" },
  { q: "I enjoy helping, teaching or counselling people.", t: "S" },
  { q: "I love leading a team, pitching ideas or convincing people.", t: "E" },
  { q: "I like organising things, making lists and following a plan.", t: "C" },
  { q: "I like working outdoors or with tools, machines or plants.", t: "R" },
  { q: "I enjoy research, reading and learning new theories.", t: "I" },
  { q: "I prefer creative freedom over fixed rules.", t: "A" },
  { q: "Friends often come to me with their problems.", t: "S" },
  { q: "I want to start my own project or business someday.", t: "E" },
  { q: "I am detail-oriented and notice small mistakes others miss.", t: "C" },
  { q: "I prefer practical activities over sitting at a desk all day.", t: "R" },
  { q: "I get excited about science, data and experiments.", t: "I" },
  { q: "I often imagine original ideas or unusual solutions.", t: "A" },
  { q: "I feel happy when I make a real difference in someone's life.", t: "S" },
  { q: "I enjoy competition and working towards ambitious goals.", t: "E" },
  { q: "I enjoy working with numbers, spreadsheets or records.", t: "C" },
];

const TRAIT_META: Record<Trait, { name: string; tag: string; emoji: string; color: string; streams: string[]; careers: string[] }> = {
  R: {
    name: "The Builder (Realistic)", tag: "Hands-on, practical, action-first", emoji: "🛠️", color: "from-amber-400 to-orange-500",
    streams: ["Engineering (Mechanical / Civil / Automobile)", "Polytechnic / ITI", "Defence and Aviation", "Agriculture"],
    careers: ["Mechanical Engineer", "Pilot", "Architect", "Defence Officer", "Automobile Designer"],
  },
  I: {
    name: "The Thinker (Investigative)", tag: "Curious, analytical, deep diver", emoji: "🧪", color: "from-indigo-500 to-violet-600",
    streams: ["Science (PCM / PCB)", "B.Sc / Research", "Computer Science and AI", "Medical / Pharmacy"],
    careers: ["Data Scientist", "Doctor", "Researcher", "AI Engineer", "Forensic Expert"],
  },
  A: {
    name: "The Creator (Artistic)", tag: "Imaginative, expressive, original", emoji: "🎨", color: "from-pink-500 to-rose-500",
    streams: ["Design (NIFT / NID)", "Mass Communication", "Fine Arts / Animation", "Performing Arts"],
    careers: ["UI/UX Designer", "Content Creator", "Filmmaker", "Fashion Designer", "Musician"],
  },
  S: {
    name: "The Helper (Social)", tag: "Warm, empathetic, people-first", emoji: "🤝", color: "from-emerald-400 to-teal-500",
    streams: ["Psychology", "Education / B.Ed", "Social Work / Sociology", "Nursing / Allied Health"],
    careers: ["Psychologist", "Teacher", "HR Manager", "Counsellor", "Doctor / Nurse"],
  },
  E: {
    name: "The Leader (Enterprising)", tag: "Bold, persuasive, founder energy", emoji: "🚀", color: "from-orange-500 to-red-500",
    streams: ["BBA / MBA", "Commerce", "Law (BA LLB)", "Hotel Management"],
    careers: ["Entrepreneur", "Marketing Manager", "Lawyer", "Investment Banker", "Brand Manager"],
  },
  C: {
    name: "The Organiser (Conventional)", tag: "Structured, precise, reliable", emoji: "📊", color: "from-sky-500 to-blue-600",
    streams: ["B.Com / CA / CS / CMA", "Banking and Finance", "Statistics / Actuarial", "Public Administration"],
    careers: ["Chartered Accountant", "Banker", "Civil Services Officer", "Data Analyst", "Auditor"],
  },
};

const LEVELS: Array<{ value: StudentLevel; label: string; short: string }> = [
  { value: "class-9", label: "Class 9", short: "Explore interests early" },
  { value: "class-10", label: "Class 10", short: "Choose the right Class 11 stream" },
  { value: "class-11", label: "Class 11", short: "Align subjects with careers" },
  { value: "class-12", label: "Class 12", short: "Choose courses and colleges" },
  { value: "graduation", label: "Graduation", short: "Plan jobs or higher study" },
];

const LEVEL_GUIDANCE: Record<StudentLevel, { title: string; description: string; action: string }> = {
  "class-9": {
    title: "Interest discovery plan",
    description: "Use this result to try clubs, projects and subjects before making a stream decision.",
    action: "Try one activity from each top trait this month and record what keeps you engaged.",
  },
  "class-10": {
    title: "Class 11 stream decision",
    description: "Compare your top traits with your marks, preferred subjects and the eligibility of future courses.",
    action: "Shortlist two streams, review their subject load and discuss both options with a counsellor.",
  },
  "class-11": {
    title: "Subject and entrance alignment",
    description: "Your result can help connect current subjects to entrance exams, courses and realistic backup options.",
    action: "Choose one primary career cluster and build a weekly subject and exam preparation routine.",
  },
  "class-12": {
    title: "Course and college shortlist",
    description: "Combine your career profile with entrance scores, budget, location and course outcomes.",
    action: "Create a reach, target and safe shortlist before application deadlines begin.",
  },
  graduation: {
    title: "Career or higher-study direction",
    description: "Use your top traits to compare job roles, specialisations, postgraduate study and skill gaps.",
    action: "Pick two target roles and map the projects, certifications or entrance exams each requires.",
  },
};

const SCALE = [
  { v: 1, label: "Not like me" },
  { v: 2, label: "Rarely" },
  { v: 3, label: "Sometimes" },
  { v: 4, label: "Often" },
  { v: 5, label: "Very much like me" },
];

export function PsychometricTestTool() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState<StudentLevel | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const selectedLevel = LEVELS.find((item) => item.value === level);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / QUESTIONS.length) * 100);

  const computeResult = () => {
    const scores: Record<Trait, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    QUESTIONS.forEach((question, index) => {
      scores[question.t] += answers[index] || 0;
    });
    const sorted = (Object.entries(scores) as [Trait, number][]).sort((a, b) => b[1] - a[1]);
    return { sorted, max: sorted[0][1] || 1 };
  };

  const reset = () => {
    setPhase("intro");
    setLevel(null);
    setAnswers({});
    setCurrentQuestion(0);
  };

  if (phase === "intro") {
    return (
      <div className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
        <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200">
            <Brain className="h-8 w-8" />
          </div>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-violet-700">
            <CircleDot className="h-3.5 w-3.5" /> Free career discovery
          </span>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Start Your Psychometric Career Test
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Answer 18 research-based interest questions and receive a clear RIASEC career profile, best-fit study paths and next steps for your current stage.
          </p>

          <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-5">
            {LEVELS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                onClick={() => setLevel(item.value)}
                aria-pressed={level === item.value}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  level === item.value
                    ? "border-violet-500 bg-violet-600 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-violet-300"
                }`}
              >
                <strong className="block text-sm">{item.label}</strong>
                <span className={`mt-1 block text-[10px] leading-4 ${level === item.value ? "text-violet-100" : "text-slate-500"}`}>{item.short}</span>
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={() => level && setPhase("lead")}
            disabled={!level}
            className="mt-6 h-14 w-full max-w-md rounded-2xl bg-violet-600 text-base font-extrabold text-white shadow-lg hover:bg-violet-700 disabled:opacity-50"
          >
            Start Psychometric Test <ChevronRight className="ml-2 h-5 w-5" />
          </Button>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> 3-5 minutes</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Private and secure</span>
            <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Classes 9-12 and graduates</span>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "lead") {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setPhase("intro")} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Change student level
        </button>
        <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h2 className="text-xl font-black text-foreground">One quick step before your test</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your details to save and receive your {selectedLevel?.label} career guidance.</p>
            </div>
          </div>
          <LeadCaptureForm
            variant="inline"
            source={`psychometric_test_start_${level}`}
            title=""
            subtitle=""
            simple
            onSuccess={() => setPhase("test")}
          />
        </div>
      </div>
    );
  }

  if (phase === "result" && level) {
    const { sorted, max } = computeResult();
    const top = sorted[0][0];
    const second = sorted[1][0];
    const topMeta = TRAIT_META[top];
    const secondMeta = TRAIT_META[second];
    const guidance = LEVEL_GUIDANCE[level];

    return (
      <div className="space-y-5">
        <div className={`rounded-3xl bg-gradient-to-br ${topMeta.color} p-6 text-white shadow-md`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90"><CircleDot className="h-3.5 w-3.5" /> Your {selectedLevel?.label} career DNA</div>
          <div className="text-4xl">{topMeta.emoji}</div>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight">{topMeta.name}</h2>
          <p className="mt-1 text-sm opacity-95">{topMeta.tag}</p>
          <p className="mt-3 text-xs opacity-90">Secondary profile: <span className="font-semibold">{secondMeta.emoji} {secondMeta.name.split("(")[0].trim()}</span></p>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-primary">{guidance.title}</p>
          <p className="mt-2 text-sm leading-6 text-foreground">{guidance.description}</p>
          <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {guidance.action}</p>
        </div>

        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your trait breakdown</p>
          <div className="space-y-2.5">
            {sorted.map(([trait, score]) => {
              const meta = TRAIT_META[trait];
              const pct = Math.round((score / max) * 100);
              return (
                <div key={trait}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-foreground">{meta.emoji} {meta.name.split("(")[0].trim()}</span><span className="text-muted-foreground">{score} points</span></div>
                  <div className="h-2 w-full rounded-full bg-muted"><div className={`h-2 rounded-full bg-gradient-to-r ${meta.color}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Best-fit study paths</p>
            <ul className="space-y-2 text-sm text-foreground">{topMeta.streams.map((stream) => <li key={stream} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{stream}</li>)}</ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">Careers to explore</p>
            <ul className="space-y-2 text-sm text-foreground">{topMeta.careers.map((career) => <li key={career} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{career}</li>)}</ul>
          </div>
        </div>

        <Button onClick={reset} variant="outline" className="h-12 w-full rounded-xl"><RotateCw className="mr-2 h-4 w-4" /> Retake test for another student level</Button>
      </div>
    );
  }

  const question = QUESTIONS[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const isLastQuestion = currentQuestion === QUESTIONS.length - 1;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-violet-800">{selectedLevel?.label} assessment</span>
          <span className="font-semibold text-violet-700">Question {currentQuestion + 1} of {QUESTIONS.length}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-[width] duration-200" style={{ width: `${Math.max(progress, ((currentQuestion + 1) / QUESTIONS.length) * 100)}%` }} /></div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <span className="text-xs font-extrabold uppercase tracking-wider text-primary">Choose the answer that feels most natural</span>
        <h2 className="mt-3 text-xl font-black leading-8 text-foreground sm:text-2xl">{question.q}</h2>
        <div className="mt-6 grid gap-2.5">
          {SCALE.map((item) => (
            <button
              key={item.v}
              type="button"
              onClick={() => setAnswers((previous) => ({ ...previous, [currentQuestion]: item.v }))}
              className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selectedAnswer === item.v ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <span>{item.label}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${selectedAnswer === item.v ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>{item.v}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((value) => Math.max(0, value - 1))} className="h-12 rounded-xl px-4">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          type="button"
          disabled={!selectedAnswer}
          onClick={() => isLastQuestion ? setPhase("result") : setCurrentQuestion((value) => value + 1)}
          className="h-12 flex-1 rounded-xl bg-violet-600 font-bold text-white hover:bg-violet-700"
        >
          {isLastQuestion ? "Reveal My Career DNA" : "Next Question"} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
