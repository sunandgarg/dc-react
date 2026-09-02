import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Globe, Users, Languages, Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DbExam } from "@/hooks/useExamsData";
import { PriorityBadge } from "@/components/PriorityBadge";
import { buildExamHref } from "@/lib/entityUrls";
import { compactDisplayText, displayText } from "@/lib/displayText";
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
  const examName = displayText(exam.name, "Exam");
  const fullName = displayText(exam.full_name);
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
        <div className="flex items-start gap-4 mb-4">
          <Link to={buildExamHref(exam)} className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden block bg-muted group">
            {exam.logo || exam.image ? (
              <img
                src={exam.logo || exam.image}
                alt={`${examName} logo`}
                className="w-full h-full bg-card p-1 object-contain group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full gradient-primary flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link to={buildExamHref(exam)} className="block group min-w-0">
                <h2 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{examName}</h2>
                {fullName && fullName !== examName && <p className="text-sm text-muted-foreground line-clamp-1">{fullName}</p>}
              </Link>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <Badge className={`text-xs border ${statusColors[exam.status] || ""}`}>
                  {exam.status}
                </Badge>
                <PriorityBadge priority={(exam as any).priority} />
              </div>
            </div>
          </div>
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
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.event}:</span>
                  <span className={`font-medium ${i >= 2 ? "text-destructive" : "text-foreground"}`}>
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
