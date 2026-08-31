import { useState } from "react";
import { BookOpen, BriefcaseBusiness, FileText, GraduationCap } from "lucide-react";
import type { DirectorySearchResult } from "@/lib/directorySearch";

const icons = {
  College: GraduationCap,
  Course: BookOpen,
  Exam: FileText,
  Career: BriefcaseBusiness,
} as const;

type SearchResultIconProps = {
  type: DirectorySearchResult["entity_type"];
  imageUrl?: string;
  alt?: string;
  className?: string;
};

export function SearchResultIcon({ type, imageUrl, alt, className = "h-10 w-10" }: SearchResultIconProps) {
  const Icon = icons[type];
  const normalizedImageUrl = imageUrl?.trim() || "";
  const [failedImageUrl, setFailedImageUrl] = useState("");

  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/10 bg-primary/10 text-primary ${className}`}>
      {normalizedImageUrl && failedImageUrl !== normalizedImageUrl ? (
        <img
          src={normalizedImageUrl}
          alt={alt || `${type} logo`}
          className="h-full w-full bg-white object-contain p-1"
          loading="eager"
          decoding="async"
          onError={() => setFailedImageUrl(normalizedImageUrl)}
        />
      ) : (
        <Icon className="h-5 w-5" aria-hidden="true" />
      )}
    </span>
  );
}
