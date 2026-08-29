export type ProtectedActionKind = "delete" | "download";

export type ProtectedActionRequest = {
  kind: ProtectedActionKind;
  label?: string;
  count?: number;
};

type ProtectedActionHandler = (request: ProtectedActionRequest) => Promise<boolean>;

let handler: ProtectedActionHandler | null = null;
const permits: Record<ProtectedActionKind, number> = { delete: 0, download: 0 };
let legacyConfirmPermit = 0;

export function registerProtectedActionHandler(next: ProtectedActionHandler | null) {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function allowNextProtectedAction(kind: ProtectedActionKind) {
  permits[kind] = Date.now() + 10_000;
}

export function allowNextLegacyConfirm() {
  legacyConfirmPermit += 1;
}

export function consumeLegacyConfirmPermit() {
  if (legacyConfirmPermit < 1) return false;
  legacyConfirmPermit -= 1;
  return true;
}

export function clearLegacyConfirmPermit() {
  legacyConfirmPermit = 0;
}

export function isAdminActionContext(pathname = typeof window === "undefined" ? "" : window.location.pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function requestProtectedAction(request: ProtectedActionRequest) {
  if (typeof window !== "undefined" && !isAdminActionContext()) return true;
  if (permits[request.kind] > Date.now()) {
    permits[request.kind] = 0;
    return true;
  }
  if (handler) return handler(request);
  return typeof window === "undefined";
}

export function classifyProtectedAction(element: Element | null): ProtectedActionKind | null {
  if (!element) return null;
  const label = [
    element.textContent,
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("download"),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(delete|remove|revoke|purge)\b/.test(label)) return "delete";
  if (/\b(download|export|csv)\b/.test(label)) return "download";
  return null;
}

export function protectedActionCopy(request: ProtectedActionRequest) {
  const count = Math.max(0, Number(request.count || 0));
  const noun = request.label?.trim() || (request.kind === "delete" ? "selected records" : "this file");
  if (request.kind === "delete") {
    const phrase = count > 0 ? `DELETE ${count} ${count === 1 ? "RECORD" : "RECORDS"}` : "DELETE";
    return {
      title: "Confirm permanent deletion",
      description: `You are about to permanently delete ${noun}. Related history and logs may also be removed. This action cannot be undone.`,
      phrase,
      actionLabel: "Delete permanently",
    };
  }
  return {
    title: "Confirm download",
    description: `Do you really want to download ${noun}? Downloads can contain private or operational data and must be handled securely.`,
    phrase: "",
    actionLabel: "Download",
  };
}
