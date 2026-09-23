import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Globe, Users, Languages, Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DbExam } from "@/hooks/useExamsData";
import { PriorityBadge } from "@/components/PriorityBadge";
import { buildExamHref } from "@/lib/entityUrls";
import { compactDisplayText } from "@/lib/displayText";
import { resolveExamNames } from "@/lib/examBranding";
import { ExamLogo } from "@/components/ExamLogo";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { useState } from "react";

interface ExamCardProps {
  exam: DbExam;
  index: number;
}

const statusColors: Record<string, string> = {
  "Upcoming": "bg-primary/10 text-primary border-primary/30",
  "Applications Open": "bg-success/10 text-success border-success/30",
  "Applications Closed": "bg-destructive/10 text-destructive border-destructive/30",
  "Exam Over": "bg-muted text-muted-foreground border-border",
};

export function ExamCard({ exam, index }: ExamCardProps) {
  const [leadOpen, setLeadOpen] = useState(false);
  const importantDates = Array.isArray(exam.important_dates)
    ? (exam.important_dates as { event: string; date: string }[])
    : [];
  const { shortName: examName, fullName } = resolveExamNames(exam);
  const category = compactDisplayText(exam.category, "General", 28);
  const level = compactDisplayText(exam.level, "Exam", 22);
  const duration = compactDisplayText(exam.duration, "-", 18);
  const mode = compactDisplayText(exam.mode, "-", 24);
  const examType = compactDisplayText(exam.exam_type, "-", 22);
  const language = compactDisplayText(exam.language, "-", 22);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 5) * 0.04, duration: 0.3 }}
    >
      <article className={`rounded-2xl border p-5 hover:shadow-lg transition-shadow h-full flex flex-col ${
        exam.status === "Applications Open" ? "bg-success/5 border-success/20" :
        exam.status === "Exam Over" ? "bg-destructive/5 border-destructive/20" :
        "bg-card border-border"
      }`}>
        {/* Header - clickable image + name */}
        <div className="flex items-start gap-3 mb-3">
          <Link to={buildExamHref(exam)} className="shrink-0" aria-label={`View ${examName}`}>
            <ExamLogo exam={exam} className="h-14 w-14" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={buildExamHref(exam)} className="block group">
              <h2 className="text-lg leading-snug font-bold text-foreground group-hover:text-primary transition-colors break-words">{examName}</h2>
              {fullName && <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words">{fullName}</p>}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {exam.status && !/^(draft|published)$/i.test(exam.status) && (
            <Badge className={`max-w-full whitespace-normal text-left text-xs border ${statusColors[exam.status] || "bg-primary/10 text-primary border-primary/20"}`}>
              {exam.status}
            </Badge>
          )}
          <PriorityBadge priority={(exam as any).priority} />
        </div>

        {/* Category & Level */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/5 font-semibold">
            {category}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">{level} Level</span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Duration: </span>
              <span className="text-xs font-medium text-foreground">{duration}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Mode: </span>
              <span className="text-xs font-medium text-foreground">{mode.split(" ")[0]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Type: </span>
              <span className="text-xs font-medium text-foreground">{examType}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground">Language: </span>
              <span className="text-xs font-medium text-foreground">{language}</span>
            </div>
          </div>
        </div>

        {/* Important Dates */}
        {importantDates.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Important Dates</h3>
            <div className="space-y-1.5">
              {importantDates.slice(0, 4).map((d, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-xs leading-relaxed">
                  <span className="text-muted-foreground break-words">{d.event}:</span>
                  <span className={`font-medium break-words ${i >= 2 ? "text-destructive" : "text-foreground"}`}>
                    {d.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frequency & Apply mode */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-4 border-b border-border">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Frequency: {exam.frequency}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Apply: {exam.application_mode}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-auto pt-3">
          <Link to={buildExamHref(exam)}>
            <Button variant="outline" className="w-full rounded-xl h-10 text-sm">
              View Details
            </Button>
          </Link>
          <Button onClick={() => setLeadOpen(true)} className="w-full rounded-xl h-10 text-sm gradient-accent text-white border-0">
            Apply Now
          </Button>
        </div>
      </article>
      <LeadGateDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        title={`Apply for ${examName}`}
        subtitle="Share your contact details, then choose your course and location."
        source={`exam_card_apply_${exam.slug}`}
        simple
        interestedExamSlug={exam.slug}
        onSuccess={() => {
          setLeadOpen(false);
          if (exam.registration_url && exam.registration_url !== "#") window.location.assign(exam.registration_url);
        }}
      />
    </motion.div>
  );
}
