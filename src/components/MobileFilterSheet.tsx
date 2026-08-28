import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterAccordionGroup, FilterGroupConfig } from "@/components/FilterAccordion";

interface MobileFilterSheetProps {
  filters: FilterGroupConfig[];
  activeCount: number;
  onClearAll: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultCount?: number;
}

export function MobileFilterSheet({ filters, activeCount, onClearAll, open, onOpenChange, resultCount }: MobileFilterSheetProps) {
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches && open) onOpenChange(false);
    };

    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [onOpenChange, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[90] h-[min(92dvh,760px)] max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] overflow-hidden p-0 flex flex-col rounded-t-2xl"
      >
        <SheetHeader className="p-4 border-b border-border flex-shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">
              Filters{activeCount > 0 && <span className="text-xs text-muted-foreground ml-2 font-normal">({activeCount} active)</span>}
            </SheetTitle>
            {activeCount > 0 && (
              <button onClick={onClearAll} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-3 touch-pan-y [-webkit-overflow-scrolling:touch]">
          {filters.map((f, i) => (
            <FilterAccordionGroup
              key={f.title}
              {...f}
              defaultOpen={i === 0 && (f.selected?.length ?? 0) > 0}
              initialVisible={8}
            />
          ))}
        </div>
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border flex-shrink-0 bg-background">
          <Button className="w-full rounded-xl h-11" onClick={() => onOpenChange(false)}>
            {typeof resultCount === "number" ? `Show ${resultCount} results` : "Apply Filters"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
