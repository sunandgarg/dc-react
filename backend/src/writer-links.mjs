import { randomBytes } from "node:crypto";
import { isIP } from "node:net";

function linkError(message) {
  return Object.assign(new Error(message), { status: 400, code: "INVALID_WRITER_LINK" });
}

export function createWriterShortLink(input, userId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw linkError("Enter one destination URL");
  const title = String(input.title || "").trim().slice(0, 120);
  if (!title) throw linkError("Give the link a name");
  if (String(input.original_url || "").length > 2048) throw linkError("Destination URL is too long");
  let destination;
  try { destination = new URL(String(input.original_url || "")); } catch { throw linkError("Enter a valid destination URL"); }
  const hostname = destination.hostname.toLowerCase();
  if (destination.protocol !== "https:" || destination.username || destination.password || !hostname.includes(".")
    || isIP(hostname) || /\.(?:local|localhost|internal|test)$/.test(hostname)) {
    throw linkError("Use a public HTTPS destination without embedded credentials");
  }
  return {
    original_url: destination.toString(), title, user_id: userId,
    short_code: randomBytes(9).toString("base64url"),
    header: null, domain: null, custom_code: false, code_length: 12,
    user_tracking: true, is_active: true,
  };
}
