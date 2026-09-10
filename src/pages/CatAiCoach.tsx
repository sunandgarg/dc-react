import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CalendarDays, Check, CheckCircle2, Clock3, Loader2, MessageSquareText, RefreshCw, Send, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CatAccessGate } from "@/components/cat/CatAccessGate";
import { CatExperienceNav } from "@/components/cat/CatExperienceNav";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSEO } from "@/hooks/useSEO";
import { catExperience, type CoachDiagnostic, type CoachPlan, readCatAccess } from "@/lib/catExperience";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

const weekDays = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

export default function CatAiCoach() {
  const [diagnostic, setDiagnostic] = useState<CoachDiagnostic>({ target_percentile: 95, hours_per_day: 2, days_to_exam: 120, current_level: "building", weakest_section: "DILR", constraints: "" });
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [completed, setCompleted] = useState<number[]>([]);
  const [gateOpen, setGateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [coachReply, setCoachReply] = useState<{ answer: string; next_action: string } | null>(null);
  const [asking, setAsking] = useState(false);

  useSEO({
    title: "Free AI CAT 2026 Study Coach and Daily Plan",
    description: "Build a practical CAT 2026 plan from your target percentile, daily study time and weakest section. Track daily work and ask focused preparation questions.",
    keywords: "CAT 2026 study plan, AI CAT coach, CAT daily timetable, VARC DILR QA preparation",
    canonical: "/cat-universe/ai-coach",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "DekhoCampus CAT 2026 AI Coach",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      url: "https://dekhocampus.com/cat-universe/ai-coach",
    },
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dc_cat_coach_plan_v1") || "null");
      if (saved?.plan) { setPlan(saved.plan); setCompleted(Array.isArray(saved.completed) ? saved.completed : []); }
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    if (!plan) return;
    try { localStorage.setItem("dc_cat_coach_plan_v1", JSON.stringify({ plan, completed, saved_at: Date.now() })); } catch { /* optional */ }
  }, [plan, completed]);

  const generateWithAccess = async (leadId: string) => {
    setLoading(true);
    try {
      const result = await catExperience<{ plan: CoachPlan; mode: string }>("coach-plan", leadId, { diagnostic, ai_personalization_consent: aiConsent });
      setPlan(result.plan);
      setCompleted([]);
      setCoachReply(null);
      trackEvent("cat_coach_plan_created", { target: diagnostic.target_percentile, weakest_section: diagnostic.weakest_section, mode: result.mode });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your plan could not be created");
    } finally {
      setLoading(false);
    }
  };

  const requestPlan = () => {
    const access = readCatAccess();
    if (access) void generateWithAccess(access);
    else setGateOpen(true);
  };

  const askCoach = async () => {
    const access = readCatAccess();
    if (!access) { setGateOpen(true); return; }
    if (question.trim().length < 5) { toast.error("Ask a complete preparation question"); return; }
    setAsking(true);
    try {
      const result = await catExperience<{ answer: string; next_action: string; mode: string }>("coach-question", access, { question, plan, ai_personalization_consent: aiConsent });
      setCoachReply(result);
      setQuestion("");
      trackEvent("cat_coach_question", { mode: result.mode });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The coach could not answer");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <CatExperienceNav />
      <main className="container py-5 md:py-8">
        <PageBreadcrumb items={[{ label: "CAT Universe", href: "/cat-universe" }, { label: "AI CAT Coach" }]} />
        <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 xl:sticky xl:top-4 xl:self-start">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div><div><div className="text-xs font-bold uppercase text-primary">Free CAT 2026 coach</div><h1 className="text-xl font-bold text-slate-950">Build your next seven days</h1></div></div>
            <div className="mt-6 space-y-5">
              <label className="block text-sm font-semibold text-slate-800">Target percentile <span className="float-right text-primary">{diagnostic.target_percentile}</span>
                <input type="range" min="70" max="99.9" step="0.5" value={diagnostic.target_percentile} onChange={(event) => setDiagnostic((item) => ({ ...item, target_percentile: Number(event.target.value) }))} className="mt-3 w-full accent-primary" />
              </label>
              <label className="block text-sm font-semibold text-slate-800">Focused hours per day <span className="float-right text-primary">{diagnostic.hours_per_day}</span>
                <input type="range" min="1" max="8" step="0.5" value={diagnostic.hours_per_day} onChange={(event) => setDiagnostic((item) => ({ ...item, hours_per_day: Number(event.target.value) }))} className="mt-3 w-full accent-primary" />
              </label>
              <label className="block text-sm font-semibold text-slate-800">Days available
                <Input type="number" min={7} max={500} value={diagnostic.days_to_exam} onChange={(event) => setDiagnostic((item) => ({ ...item, days_to_exam: Number(event.target.value) }))} className="mt-2 rounded-md" />
              </label>
              <fieldset><legend className="text-sm font-semibold text-slate-800">Current level</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["starting", "building", "mock-ready"] as const).map((level) => <button key={level} type="button" onClick={() => setDiagnostic((item) => ({ ...item, current_level: level }))} className={`min-h-10 rounded-md border px-2 text-xs font-semibold capitalize ${diagnostic.current_level === level ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600"}`}>{level}</button>)}</div></fieldset>
              <fieldset><legend className="text-sm font-semibold text-slate-800">Weakest section</legend><div className="mt-2 grid grid-cols-3 gap-2">{(["VARC", "DILR", "QA"] as const).map((section) => <button key={section} type="button" onClick={() => setDiagnostic((item) => ({ ...item, weakest_section: section }))} className={`h-10 rounded-md border text-sm font-semibold ${diagnostic.weakest_section === section ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600"}`}>{section}</button>)}</div></fieldset>
              <label className="block text-sm font-semibold text-slate-800">Schedule constraints
                <Textarea value={diagnostic.constraints} onChange={(event) => setDiagnostic((item) => ({ ...item, constraints: event.target.value }))} placeholder="College, job, commute or fixed classes" maxLength={240} className="mt-2 min-h-20 rounded-md" />
              </label>
              <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" /><span><strong className="text-slate-800">Use Gemini personalization.</strong> Your diagnostic and coach questions are sent for this session. Leave off for the private guided plan.</span></label>
              <Button onClick={requestPlan} disabled={loading} className="h-11 w-full rounded-md">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : plan ? <RefreshCw className="h-4 w-4" /> : <Target className="h-4 w-4" />}{plan ? "Rebuild plan" : "Create free plan"}</Button>
            </div>
          </aside>

          <section>
            {!plan ? (
              <div className="flex min-h-[620px] flex-col justify-center border-l-4 border-primary bg-white px-6 py-12 md:px-12">
                <div className="text-sm font-bold uppercase text-primary">AI-first preparation</div>
                <h2 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight text-slate-950 md:text-5xl">A plan that tells you what to do today</h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Your available time is distributed across VARC, DILR and QA, with the weakest section receiving deliberate repair work and every week ending in measurable review.</p>
                <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-4"><Clock3 className="h-5 w-5 text-primary" /><div className="mt-3 font-bold text-slate-900">Daily allocation</div></div>
                  <div className="rounded-lg border border-slate-200 p-4"><BarChart3 className="h-5 w-5 text-emerald-600" /><div className="mt-3 font-bold text-slate-900">Section checkpoints</div></div>
                  <div className="rounded-lg border border-slate-200 p-4"><CalendarDays className="h-5 w-5 text-orange-600" /><div className="mt-3 font-bold text-slate-900">Seven-day cycle</div></div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <header className="rounded-lg border border-slate-200 bg-white p-6 md:p-8"><div className="text-sm font-bold uppercase text-primary">Your current plan</div><h1 className="mt-2 text-3xl font-extrabold text-slate-950">{plan.headline}</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">{plan.strategy}</p></header>

                <div className="grid gap-4 md:grid-cols-3">{plan.section_goals.map((item) => <article key={item.section} className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-950">{item.section}</h2><span className="text-sm font-bold text-primary">{item.minutes} min</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{item.goal}</p></article>)}</div>

                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-950">Today</h2><div className="mt-4 space-y-3">{plan.today.map((task, index) => { const done = completed.includes(index); return <button key={task} type="button" onClick={() => setCompleted((items) => done ? items.filter((item) => item !== index) : [...items, index])} className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm leading-6 ${done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>{done ? <Check className="h-3.5 w-3.5" /> : null}</span>{task}</button>; })}</div></section>
                  <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-950">Seven-day cycle</h2><div className="mt-4 divide-y divide-slate-200">{plan.week.map((item, index) => <div key={`${item}-${index}`} className="grid grid-cols-[70px_1fr] gap-3 py-3 text-sm"><span className="font-bold text-primary">{weekDays[index]}</span><span className="text-slate-600">{item}</span></div>)}</div></section>
                </div>

                <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-950">Weekly checkpoints</h2></div><div className="mt-4 grid gap-3 md:grid-cols-3">{plan.checkpoints.map((item) => <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{item}</div>)}</div></section>

                <section className="rounded-lg border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-slate-950">Ask the coach</h2></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void askCoach(); }} placeholder="Ask about your next practice decision" className="h-11 rounded-md" maxLength={1200} /><Button onClick={() => void askCoach()} disabled={asking} className="h-11 rounded-md">{asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Ask</Button></div>{coachReply ? <div className="mt-4 border-l-4 border-primary bg-slate-50 p-4"><p className="leading-7 text-slate-700">{coachReply.answer}</p><p className="mt-3 text-sm font-semibold text-primary">Next: {coachReply.next_action}</p></div> : null}</section>
              </div>
            )}
          </section>
        </div>
        <Link to="/cat-universe/cat-2026-preparation-kit" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Back to CAT 2026 kit</Link>
      </main>
      <Footer />
      <CatAccessGate open={gateOpen} onOpenChange={setGateOpen} source="cat_ai_coach_access" title="Unlock your free CAT plan" onGranted={(leadId) => void generateWithAccess(leadId)} />
    </div>
  );
}
