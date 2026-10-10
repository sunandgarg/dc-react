import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("single website font", () => {
  it("uses the same family for body, article text, headings and font utilities", () => {
    const css = read("src/index.css");
    const html = read("index.html");
    const config = read("tailwind.config.ts");
    const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((match) => match[1].replace(/\s*!important$/, ""));
    expect(families.length).toBeGreaterThan(3);
    expect(new Set(families)).toEqual(new Set(["var(--font-site, sans-serif)"]));
    expect(html).toContain('href="/fonts/site-font.css"');
    expect(html).toContain('href="/fonts/noto-sans-devanagari-latin.woff2" as="font"');
    for (const utility of ["sans", "display", "serif", "mono"]) {
      expect(config).toContain(`${utility}: ['var(--font-site, sans-serif)']`);
    }
    expect(css).toMatch(/:where\(\.prose, \.article-prose, \.ProseMirror\) \*\s*\{\s*font-family: var\(--font-site, sans-serif\) !important/);
  });

  it("ships valid local variable font subsets with the same family and license", () => {
    const css = read("public/fonts/site-font.css");
    expect(css.match(/font-family: "Noto Sans Devanagari"/g)).toHaveLength(3);
    expect(css.match(/font-weight: 400 900/g)).toHaveLength(3);
    expect(css).toContain("U+0900-097F");
    expect(css).not.toMatch(/https?:\/\//);
    for (const match of css.matchAll(/url\("\/([^"\)]+)"\)/g)) {
      const font = readFileSync(resolve(process.cwd(), "public", match[1]));
      expect(font.subarray(0, 4).toString()).toBe("wOF2");
    }
    expect(read("public/fonts/OFL.txt")).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
