export function verifyCoreEntityInitialHtml({ status, html, expectedUrl, marker }) {
  if (status !== 200) throw new Error(`${expectedUrl} returned HTTP ${status}`);
  if (!html.includes(marker)) throw new Error(`${expectedUrl} is missing its content marker in initial HTML`);
  const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)?.[1];
  if (canonical !== expectedUrl.replace(/\/$/, "")) throw new Error(`${expectedUrl} has an unexpected initial canonical: ${canonical || "missing"}`);
  const robots = html.match(/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']([^"']*)["'])[^>]*>/i)?.[1];
  if (!robots || /\bnoindex\b/i.test(robots) || !/\bindex\b/i.test(robots)) throw new Error(`${expectedUrl} has missing or nonindexable initial robots metadata`);
}
