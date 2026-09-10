import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BrainCircuit, CheckCircle2, Clock3, Loader2, Mic, RotateCcw, Send, Square, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CatAccessGate } from "@/components/cat/CatAccessGate";
import { CatExperienceNav } from "@/components/cat/CatExperienceNav";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSEO } from "@/hooks/useSEO";
import { averageInterviewScore, catExperience, type InterviewFeedback, type InterviewProfile, type InterviewScores, readCatAccess } from "@/lib/catExperience";
import { trackEvent } from "@/lib/analytics";
import { toast } from "sonner";

type InterviewExchange = { question: string; feedback: InterviewFeedback };
const scoreLabels: Array<keyof InterviewScores> = ["clarity", "structure", "relevance", "evidence", "confidence"];
const focusOptions: Array<{ value: InterviewProfile["focus"]; label: string }> = [
  { value: "general", label: "Personal fit" },
  { value: "academics", label: "Academics" },
  { value: "work", label: "Work experience" },
  { value: "current_affairs", label: "Current affairs" },
];

export default function CatInterviewPractice() {
  const [profile, setProfile] = useState<InterviewProfile>({ target: "IIM personal interview", focus: "general", difficulty: "standard" });
  const [stage, setStage] = useState<"setup" | "interview" | "complete">("setup");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [history, setHistory] = useState<InterviewExchange[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [nextQuestion, setNextQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const recognitionRef = useRef<any>(null);
  const questionStartedAt = useRef(Date.now());

  useSEO({
    title: "Free AI IIM Interview Practice for CAT 2026",
    description: "Practise IIM and MBA admission interview questions with immediate feedback across clarity, structure, relevance, evidence and confidence.",
    keywords: "IIM interview practice, CAT 2026 interview, MBA mock interview AI, personal interview questions",
    canonical: "/cat-universe/ai-interview-practice",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "DekhoCampus AI Interview Practice",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      url: "https://dekhocampus.com/cat-universe/ai-interview-practice",
    },
  });

  const startWithAccess = async (leadId: string) => {
    setLoading(true);
    try {
      const result = await catExperience<{ question: string; question_index: number }>("interview-start", leadId, { profile });
      setQuestion(result.question);
      setQuestionIndex(result.question_index || 0);
      setHistory([]);
      setFeedback(null);
      setAnswer("");
      questionStartedAt.current = Date.now();
      setStage("interview");
      trackEvent("cat_interview_start", { focus: profile.focus, difficulty: profile.difficulty });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Interview practice could not start");
    } finally {
      setLoading(false);
    }
  };

  const requestStart = () => {
    const access = readCatAccess();
    if (access) void startWithAccess(access);
    else setGateOpen(true);
  };

  const submitAnswer = async () => {
    if (answer.trim().length < 20) {
      toast.error("Give a fuller answer before requesting feedback");
      return;
    }
    const access = readCatAccess();
    if (!access) { setGateOpen(true); return; }
    setLoading(true);
    try {
      const result = await catExperience<{ feedback: InterviewFeedback; next_question: string; mode: string }>("interview-answer", access, {
        profile,
        question,
        answer,
        question_index: questionIndex,
        ai_scoring_consent: aiConsent,
      });
      setFeedback(result.feedback);
      setNextQuestion(result.next_question);
      setHistory((items) => [...items, { question, feedback: result.feedback }]);
      trackEvent("cat_interview_answer_scored", { question_number: questionIndex + 1, mode: result.mode });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your answer could not be scored");
    } finally {
      setLoading(false);
    }
  };

  const continueInterview = () => {
    if (history.length >= 5) {
      setStage("complete");
      trackEvent("cat_interview_complete", { average_score: averageInterviewScore(history.map((item) => item.feedback.scores)) });
      return;
    }
    setQuestion(nextQuestion);
    setQuestionIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
    setNextQuestion("");
    questionStartedAt.current = Date.now();
  };

  const toggleDictation = () => {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      toast.info("Voice dictation is not available in this browser");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results).map((result: any) => result[0]?.transcript || "").join(" ");
      setAnswer(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const overallScore = useMemo(() => averageInterviewScore(history.map((item) => item.feedback.scores)), [history]);
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 60000));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <CatExperienceNav />
      <main className="container py-5 md:py-8">
        <PageBreadcrumb items={[{ label: "CAT Universe", href: "/cat-universe" }, { label: "AI Interview Practice" }]} />

        {stage === "setup" ? (
          <div className="mt-6 grid min-h-[600px] gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="flex flex-col justify-center">
              <div className="text-sm font-bold uppercase text-primary">IIM interview room</div>
              <h1 className="mt-3 max-w-xl text-4xl font-extrabold leading-tight text-slate-950 md:text-5xl">Practise the answer, not a script</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">One question at a time. Immediate feedback on clarity, structure, relevance, evidence and confidence.</p>
              <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-5">
                {scoreLabels.map((label) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-semibold capitalize text-slate-600">{label}</div>)}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-7" aria-labelledby="interview-setup-heading">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
                <div><h2 id="interview-setup-heading" className="text-xl font-bold text-slate-950">Interview setup</h2><p className="text-sm text-slate-500">Your first question adapts to this profile.</p></div>
              </div>
              <div className="mt-6 space-y-5">
                <label className="block text-sm font-semibold text-slate-800">Target interview
                  <Input value={profile.target} onChange={(event) => setProfile((item) => ({ ...item, target: event.target.value }))} className="mt-2 rounded-md" maxLength={100} />
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-800">Focus</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {focusOptions.map((item) => <button key={item.value} type="button" onClick={() => setProfile((value) => ({ ...value, focus: item.value }))} className={`h-10 rounded-md border px-3 text-sm font-semibold ${profile.focus === item.value ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item.label}</button>)}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-800">Pressure level</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["foundation", "standard", "pressure"] as const).map((item) => <button key={item} type="button" onClick={() => setProfile((value) => ({ ...value, difficulty: item }))} className={`h-10 rounded-md border px-2 text-sm font-semibold capitalize ${profile.difficulty === item ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item}</button>)}
                  </div>
                </fieldset>
                <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                  <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                  <span><strong className="text-slate-800">Use Gemini feedback for this session.</strong> The current question and answer are sent for scoring and are not stored by DekhoCampus. Leave off for private guided scoring.</span>
                </label>
                <Button onClick={requestStart} disabled={loading} className="h-11 w-full rounded-md">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} Start five-question practice</Button>
              </div>
            </section>
          </div>
        ) : null}

        {stage === "interview" ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div><div className="text-xs font-bold uppercase text-primary">Question {Math.min(questionIndex + 1, 5)} of 5</div><div className="mt-2 h-2 w-40 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-primary" style={{ width: `${Math.min(100, ((questionIndex + 1) / 5) * 100)}%` }} /></div></div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><Clock3 className="h-4 w-4" />{elapsedMinutes} min</div>
              </div>
              <h1 className="mt-7 text-2xl font-bold leading-9 text-slate-950 md:text-3xl">{question}</h1>
              <div className="mt-6">
                <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={Boolean(feedback)} placeholder="Your answer" className="min-h-56 resize-y rounded-md text-base leading-7" maxLength={2500} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={toggleDictation} disabled={Boolean(feedback)} className="rounded-md" title={listening ? "Stop voice answer" : "Dictate answer"}>{listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{listening ? "Stop" : "Voice"}</Button>
                    {!feedback ? <Button onClick={() => void submitAnswer()} disabled={loading} className="rounded-md">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Score answer</Button> : <Button onClick={continueInterview} className="rounded-md">{history.length >= 5 ? "Finish" : "Next question"}<ArrowRight className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </div>
              {feedback ? (
                <div className="mt-7 border-t border-slate-200 pt-6">
                  <h2 className="text-lg font-bold text-slate-950">Interviewer feedback</h2>
                  <p className="mt-2 leading-7 text-slate-600">{feedback.summary}</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div><div className="text-sm font-bold text-emerald-700">Working well</div>{feedback.strengths.map((item) => <div key={item} className="mt-2 flex gap-2 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</div>)}</div>
                    <div><div className="text-sm font-bold text-orange-700">Strengthen next</div>{feedback.improvements.map((item) => <div key={item} className="mt-2 flex gap-2 text-sm text-slate-600"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />{item}</div>)}</div>
                  </div>
                  <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong>Sharper answer shape:</strong> {feedback.better_answer_shape}</div>
                </div>
              ) : null}
            </section>

            <aside className="rounded-lg border border-slate-200 bg-white p-5 lg:sticky lg:top-4 lg:self-start">
              <div className="flex items-center justify-between"><h2 className="font-bold text-slate-950">Readiness</h2><span className="text-2xl font-extrabold text-primary">{overallScore || "-"}</span></div>
              <div className="mt-5 space-y-4">{scoreLabels.map((label) => { const value = feedback?.scores[label] || (history.length ? history[history.length - 1].feedback.scores[label] : 0); return <div key={label}><div className="mb-1 flex justify-between text-xs font-semibold capitalize text-slate-600"><span>{label}</span><span>{value || "-"}/10</span></div><Progress value={value * 10} className="h-2" /></div>; })}</div>
              <div className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500">Raw practice answers are not saved by DekhoCampus.</div>
            </aside>
          </div>
        ) : null}

        {stage === "complete" ? (
          <section className="mx-auto mt-10 max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-center md:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <div className="mt-4 text-sm font-bold uppercase text-emerald-700">Practice complete</div>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Interview readiness: {overallScore}/10</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">Use the lowest score as the focus for your next five-question round.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3"><Button onClick={() => setStage("setup")} className="rounded-md"><RotateCcw className="h-4 w-4" /> New practice</Button><Button asChild variant="outline" className="rounded-md"><Link to="/cat-universe/ai-coach">Open AI coach <ArrowRight className="h-4 w-4" /></Link></Button></div>
          </section>
        ) : null}

        <Link to="/cat-universe/cat-2026-preparation-kit" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Back to CAT 2026 kit</Link>
      </main>
      <Footer />
      <CatAccessGate open={gateOpen} onOpenChange={setGateOpen} source="cat_ai_interview_access" title="Unlock free interview practice" onGranted={(leadId) => void startWithAccess(leadId)} />
    </div>
  );
}
