import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GraduationCap } from "lucide-react";

import { resolveDirectoryMediaUrl } from "@/lib/directorySearch";
import { cn } from "@/lib/utils";

interface InstitutionLogoProps {
  src?: unknown;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
  loading?: "eager" | "lazy";
}

export function InstitutionLogo({
  src,
  alt,
  className,
  imageClassName,
  fallback,
  loading = "lazy",
}: InstitutionLogoProps) {
  const resolvedSrc = useMemo(() => resolveDirectoryMediaUrl(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolvedSrc]);

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}>
      {resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={cn("h-full w-full object-contain", imageClassName)}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback ?? <GraduationCap className="h-1/2 w-1/2 text-primary" aria-hidden="true" />
      )}
    </span>
  );
}
