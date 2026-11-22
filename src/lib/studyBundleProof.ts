const KEY = "dc_study_bundle_proof_v1";

import { functionUrl } from "@/lib/backendMode";

export function getStudyBundleProof(): { token: string; phone: string } | null {
  try {
    const token = localStorage.getItem(KEY) || "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.purpose === "study_bundle" && /^\+91[6-9]\d{9}$/.test(payload.phone) && Number(payload.exp) * 1000 > Date.now()) {
      return { token, phone: payload.phone };
    }
  } catch { /* Missing or malformed proof requires OTP. */ }
  return null;
}

export function saveStudyBundleProof(token: string) {
  try { localStorage.setItem(KEY, token); } catch { /* The current download still works. */ }
}

export function clearStudyBundleProof() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

export async function requestStudyBundleDownload(resourceId: string, proof: { token: string; phone: string }): Promise<string> {
  const response = await fetch(functionUrl("study-bundle-download"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource_id: resourceId, phone: proof.phone, study_bundle_token: proof.token }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.download_url) throw new Error(body.message || body.error || "Could not download the bundle");
  return body.download_url;
}
