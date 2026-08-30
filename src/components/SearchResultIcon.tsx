import { BookOpen, BriefcaseBusiness, FileText, GraduationCap } from "lucide-react";
import type { DirectorySearchResult } from "@/lib/directorySearch";

const icons = {
  College: GraduationCap,
  Course: BookOpen,
  Exam: FileText,
  Career: BriefcaseBusiness,
} as const;

export function SearchResultIcon({ type, className = "h-10 w-10" }: { type: DirectorySearchResult["entity_type"]; className?: string }) {
  const Icon = icons[type];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-primary ${className}`} aria-hidden="true">
      <Icon className="h-5 w-5" />
    </span>
  );
}
