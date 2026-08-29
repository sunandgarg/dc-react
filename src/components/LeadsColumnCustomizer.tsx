import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Columns3, GripVertical, RotateCcw, Search, X } from "lucide-react";

export type LeadColumnDef = {
  key: string;
  label: string;
  defaultVisible?: boolean;
};

type Props = {
  columns: LeadColumnDef[];
  order: string[];
  visible: Record<string, boolean>;
  onChange: (next: { order: string[]; visible: Record<string, boolean> }) => void;
  onReset: () => void;
};

/** Searchable two-pane column picker with an explicit apply action. */
export function LeadsColumnCustomizer({ columns, order, visible, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftOrder, setDraftOrder] = useState(order);
  const [draftVisible, setDraftVisible] = useState(visible);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraftOrder(order);
    setDraftVisible(visible);
    setQuery("");
  }, [open, order, visible]);

  const ordered = useMemo(() => draftOrder
    .map((key) => columns.find((column) => column.key === key))
    .filter(Boolean) as LeadColumnDef[], [columns, draftOrder]);
  const selected = ordered.filter((column) => draftVisible[column.key] !== false);
  const filtered = ordered.filter((column) => column.label.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleCount = order.filter((key) => visible[key] !== false).length;

  const handleDrop = (target: string) => {
    if (!dragKey || dragKey === target) return;
    const from = draftOrder.indexOf(dragKey);
    const to = draftOrder.indexOf(target);
    if (from < 0 || to < 0) return;
    const next = [...draftOrder];
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    setDraftOrder(next);
    setDragKey(null);
    setOverKey(null);
  };

  const resetDraft = () => {
    onReset();
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setOpen(true)}>
        <Columns3 className="w-4 h-4" />
        Columns
        <span className="text-[10px] text-muted-foreground">({visibleCount}/{columns.length})</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2"><Columns3 className="h-5 w-5 text-primary" /> Customize columns</DialogTitle>
            <DialogDescription>Lead table field visibility and order.</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[480px] grid-cols-1 md:grid-cols-2">
            <section className="border-b p-4 md:border-b-0 md:border-r">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search columns" className="pl-9" />
              </div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Available fields</div>
              <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
                {filtered.map((column) => (
                  <label key={column.key} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition ${draftVisible[column.key] !== false ? "border-primary/30 bg-primary/5" : "border-transparent hover:bg-muted"}`}>
                    <Checkbox checked={draftVisible[column.key] !== false} onCheckedChange={(checked) => setDraftVisible((current) => ({ ...current, [column.key]: !!checked }))} />
                    <span className="text-sm">{column.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Selected column order</span>
                <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              </div>
              <div className="max-h-[424px] space-y-1 overflow-y-auto pr-1">
                {selected.map((column) => (
                  <div
                    key={column.key}
                    draggable
                    onDragStart={() => setDragKey(column.key)}
                    onDragOver={(event) => { event.preventDefault(); setOverKey(column.key); }}
                    onDragLeave={() => setOverKey(null)}
                    onDrop={() => handleDrop(column.key)}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    className={`flex cursor-grab items-center gap-2 rounded-md border px-3 py-2.5 active:cursor-grabbing ${overKey === column.key && dragKey !== column.key ? "border-primary border-dashed bg-primary/5" : "bg-card"} ${dragKey === column.key ? "opacity-40" : ""}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">{column.label}</span>
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setDraftVisible((current) => ({ ...current, [column.key]: false }))} title={`Hide ${column.label}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
            <Button variant="ghost" size="sm" className="gap-2" onClick={resetDraft}><RotateCcw className="h-3.5 w-3.5" /> Restore default</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => { onChange({ order: draftOrder, visible: draftVisible }); setOpen(false); }}>Apply columns</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
