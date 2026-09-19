import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { normalizePage, paginationItems } from "@/lib/pagination";

interface NumberedPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hrefForPage?: (page: number) => string;
  disabled?: boolean;
  className?: string;
}

export function NumberedPagination({
  page,
  totalPages,
  onPageChange,
  hrefForPage,
  disabled = false,
  className,
}: NumberedPaginationProps) {
  const total = Math.max(1, Math.floor(totalPages));
  const current = normalizePage(page, total);
  const items = paginationItems(current, total);

  const activate = (event: MouseEvent<HTMLAnchorElement>, target: number) => {
    if (disabled || target === current) {
      event.preventDefault();
      return;
    }
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onPageChange(target);
    }
  };

  const href = (target: number) => hrefForPage?.(target) || "#";

  return (
    <nav aria-label="Article pages" className={cn("flex w-full items-center justify-center", className)}>
      <ul className="flex max-w-full items-center gap-1 overflow-x-auto px-1 py-1 scrollbar-hide">
        <li>
          <a
            href={href(Math.max(1, current - 1))}
            onClick={(event) => activate(event, current - 1)}
            aria-disabled={disabled || current === 1}
            title="Previous page"
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold transition-colors hover:bg-muted sm:px-3",
              (disabled || current === 1) && "pointer-events-none opacity-40",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </a>
        </li>

        {items.map((item) => item === "ellipsis-start" || item === "ellipsis-end" ? (
          <li key={item} aria-hidden="true" className="inline-flex h-9 w-8 items-center justify-center text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </li>
        ) : (
          <li key={item}>
            <a
              href={href(item)}
              onClick={(event) => activate(event, item)}
              aria-current={item === current ? "page" : undefined}
              aria-label={`Page ${item}`}
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors",
                item === current
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-transparent text-foreground hover:border-border hover:bg-muted",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              {item}
            </a>
          </li>
        ))}

        <li>
          <a
            href={href(Math.min(total, current + 1))}
            onClick={(event) => activate(event, current + 1)}
            aria-disabled={disabled || current === total}
            title="Next page"
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-sm font-semibold transition-colors hover:bg-muted sm:px-3",
              (disabled || current === total) && "pointer-events-none opacity-40",
            )}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </a>
        </li>
      </ul>
    </nav>
  );
}
