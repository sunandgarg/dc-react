import { CircleDot } from "lucide-react";

interface Props {
  exam: any;
}

export function ExamAIInsight({ exam }: Props) {
  const summary: string | undefined = (exam as any).ai_summary || undefined;
  const fallback = (
    <>
      Review the {exam.name} eligibility, current dates and exam pattern before you apply.
      {exam.mode && <> The listed mode is <span className="font-bold text-slate-900">{exam.mode}</span>.</>}
      {exam.duration && <> The listed duration is <span className="font-bold text-slate-900">{exam.duration}</span>.</>}
      {" "}Confirm any changes on the conducting authority's website.
    </>
  );

  return (
    <section className="bg-blue-50/60 border border-blue-100 rounded-3xl p-5 md:p-6">
      <div className="flex items-center gap-3 mb-3 md:mb-4">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
          <CircleDot className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-blue-700 text-sm md:text-base">{summary ? "DekhoCampus AI Insight" : "Exam at a glance"}</span>
      </div>
      <p className="text-slate-700 leading-relaxed text-sm md:text-base">
        {summary ? summary : fallback}
      </p>
    </section>
  );
}
