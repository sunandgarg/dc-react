import { useState } from "react";
import { FileText } from "lucide-react";
import { resolveExamLogo, resolveExamNames } from "@/lib/examBranding";
import { cn } from "@/lib/utils";

type ExamLogoProps = {
  exam: Parameters<typeof resolveExamLogo>[0];
  className?: string;
  eager?: boolean;
};

export function ExamLogo({ exam, className, eager = false }: ExamLogoProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const source = [resolveExamLogo(exam), resolveExamLogo({ ...exam, logo: "" })]
    .find((url) => url && !failedSources.includes(url));
  const { shortName } = resolveExamNames(exam);
  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-white rounded-lg", className)}>
      {source ? (
        <img
          src={source}
          alt={`${shortName} logo`}
          className="h-full w-full object-contain"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSources((previous) => previous.includes(source) ? previous : [...previous, source])}
        />
      ) : (
        <FileText className="h-7 w-7 text-muted-foreground" aria-label={`${shortName}: logo unavailable`} />
      )}
    </div>
  );
}
