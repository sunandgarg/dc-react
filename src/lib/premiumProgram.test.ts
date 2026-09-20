import { describe, expect, it } from "vitest";
import { isIitIimProgram, resolvePremiumProgramMedia } from "@/lib/premiumProgram";

describe("isIitIimProgram", () => {
  it.each([
    [{ college_name: "IIT Kharagpur" }],
    [{ title: "Executive leadership programme from IIM Kozhikode" }],
    [{ slug: "applied-ai-and-agentic-ai-iiit-bangalore" }],
    [{ college_name: "IIIT-B & IIM, Udaipur" }],
    [{ college_name: "Indian Institute of Technology Kharagpur" }],
    [{ title: "Programme by International Institute of Information Technology Bangalore" }],
    [{ title: "Executive leadership programme", tag: "IIM" }],
  ])("recognises IIT, IIM and IIIT programmes across imported fields", (program) => {
    expect(isIitIimProgram(program)).toBe(true);
  });

  it("does not match the acronym inside unrelated words", () => {
    expect(isIitIimProgram({ title: "Global Summit for Product Leaders", slug: "global-summit" })).toBe(false);
  });

  it("uses the curated campus image and institute logo for mapped programmes", () => {
    expect(resolvePremiumProgramMedia({
      slug: "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur",
      hero_image: "https://example.com/generic-cover.webp",
      institute_logo: "https://example.com/generic-logo.webp",
    })).toEqual({
      heroImage: expect.stringMatching(/^\/assets\/programs\/iit-iim\/hero-[a-f0-9]{16}\.webp$/),
      instituteLogo: expect.stringMatching(/^\/assets\/programs\/iit-iim\/logo-[a-f0-9]{16}\.webp$/),
    });
  });

  it("preserves database media for programmes outside the curated set", () => {
    expect(resolvePremiumProgramMedia({
      slug: "global-product-leadership",
      hero_image: "https://example.com/hero.webp",
      institute_logo: "https://example.com/logo.webp",
    })).toEqual({
      heroImage: "https://example.com/hero.webp",
      instituteLogo: "https://example.com/logo.webp",
    });
  });
});
