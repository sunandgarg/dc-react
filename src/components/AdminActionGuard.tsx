import { useCallback, useEffect, useState } from "react";
import { Download, ShieldAlert, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  allowNextLegacyConfirm,
  allowNextProtectedAction,
  classifyProtectedAction,
  clearLegacyConfirmPermit,
  consumeLegacyConfirmPermit,
  isAdminActionContext,
  protectedActionCopy,
  registerProtectedActionHandler,
  requestProtectedAction,
  type ProtectedActionRequest,
} from "@/lib/protectedActions";

type Pending = ProtectedActionRequest & { resolve: (allowed: boolean) => void };

export function AdminActionGuard() {
  const { isAdmin, isLoading } = useAuth();
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const copy = pending ? protectedActionCopy(pending) : null;

  const close = useCallback((allowed: boolean) => {
    setPending((current) => {
      current?.resolve(allowed);
      return null;
    });
    setTyped("");
  }, []);

  useEffect(() => registerProtectedActionHandler((request) => new Promise<boolean>((resolve) => {
    setTyped("");
    setPending({ ...request, resolve });
  })), []);

  useEffect(() => {
    const originalConfirm = window.confirm.bind(window);
    window.confirm = (message?: string) => consumeLegacyConfirmPermit() ? true : originalConfirm(message);
    return () => { window.confirm = originalConfirm; };
  }, []);

  useEffect(() => {
    const capture = (event: MouseEvent) => {
      if (!isAdminActionContext()) return;
      const target = event.target instanceof Element ? event.target.closest("button,a,[role='button']") : null;
      if (!target || target.closest("[data-protected-action-guard='ignore']")) return;
      const approved = target.getAttribute("data-protected-action-approved");
      if (approved) {
        target.removeAttribute("data-protected-action-approved");
        return;
      }
      const kind = classifyProtectedAction(target);
      if (!kind) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const label = (target.getAttribute("aria-label") || target.getAttribute("title") || target.textContent || "").trim();
      const countMatch = label.match(/\b(\d+)\b/);
      void requestProtectedAction({ kind, label, count: countMatch ? Number(countMatch[1]) : undefined }).then((allowed) => {
        if (!allowed) return;
        allowNextProtectedAction(kind);
        allowNextLegacyConfirm();
        target.setAttribute("data-protected-action-approved", kind);
        (target as HTMLElement).click();
        clearLegacyConfirmPermit();
      });
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, []);

  const allowed = Boolean(pending && !isLoading && isAdmin);
  const phraseMatches = pending?.kind !== "delete" || typed.trim().toUpperCase() === copy?.phrase;

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => { if (!open) close(false); }}>
      <DialogContent data-protected-action-guard="ignore" className="max-w-xl overflow-hidden p-0" onEscapeKeyDown={() => close(false)}>
        <DialogHeader className="border-b bg-muted/35 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${pending?.kind === "delete" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {pending?.kind === "delete" ? <Trash2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>{allowed ? copy?.title : "Administrator access required"}</DialogTitle>
              <DialogDescription className="mt-1.5">
                {allowed ? copy?.description : "Only an administrator can delete records or download operational data."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {allowed && pending?.kind === "delete" && (
            <div className="rounded-md border border-destructive/25 bg-destructive/5 p-4">
              <p className="text-sm font-medium">Type <span className="font-mono text-destructive">{copy?.phrase}</span> to confirm:</p>
              <Input value={typed} onChange={(event) => setTyped(event.target.value)} className="mt-3 font-mono" autoFocus autoComplete="off" />
            </div>
          )}
          {!allowed && <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800"><ShieldAlert className="h-4 w-4" /> This action has been blocked.</div>}
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => close(false)}>{allowed ? "Cancel" : <><X className="mr-2 h-4 w-4" />Close</>}</Button>
          {allowed && <Button variant={pending?.kind === "delete" ? "destructive" : "default"} disabled={!phraseMatches} onClick={() => close(true)}>{copy?.actionLabel}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
