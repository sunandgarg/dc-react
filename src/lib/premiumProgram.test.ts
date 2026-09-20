import { describe, expect, it } from "vitest";
import { isIitIimProgram, resolvePremiumProgramMedia } from "@/lib/premiumProgram";
import { UPGRAD_PROGRAM_MEDIA } from "@/lib/upgradProgramMedia.generated";

const AWS_PROGRAMME_MEDIA_PREFIX = "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/";

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

  it("uses the audited AWS hero, logo and certificate for mapped programmes", () => {
    const resolved = resolvePremiumProgramMedia({
      slug: "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur",
      hero_image: "https://example.com/generic-cover.webp",
      institute_logo: "https://example.com/generic-logo.webp",
      certificate_image: "https://example.com/generic-certificate.webp",
      degree_image: "https://example.com/degree.webp",
    });

    expect(resolved).toEqual({
      heroImage: expect.stringMatching(/^https:\/\/aws-origin\.dekhocampus\.com\//),
      instituteLogo: expect.stringMatching(/^https:\/\/aws-origin\.dekhocampus\.com\//),
      certificateImage: expect.stringMatching(/^https:\/\/aws-origin\.dekhocampus\.com\//),
      degreeImage: "https://example.com/degree.webp",
    });
  });

  it("preserves database media for programmes outside the curated set", () => {
    expect(resolvePremiumProgramMedia({
      slug: "global-product-leadership",
      hero_image: "https://example.com/hero.webp",
      institute_logo: "https://example.com/logo.webp",
      certificate_image: "https://example.com/certificate.webp",
      degree_image: "https://example.com/degree.webp",
    })).toEqual({
      heroImage: "https://example.com/hero.webp",
      instituteLogo: "https://example.com/logo.webp",
      certificateImage: "https://example.com/certificate.webp",
      degreeImage: "https://example.com/degree.webp",
    });
  });

  it("falls back to database media for assets excluded by quality review", () => {
    expect(resolvePremiumProgramMedia({
      slug: "advanced-general-management-program-from-imt-ghaziabad-imt-ghaziabad",
      hero_image: "https://example.com/imt-hero.webp",
      institute_logo: "https://example.com/imt-logo.webp",
      certificate_image: "https://example.com/imt-certificate.webp",
    })).toEqual({
      heroImage: "https://example.com/imt-hero.webp",
      instituteLogo: expect.stringMatching(/^https:\/\/aws-origin\.dekhocampus\.com\//),
      certificateImage: "https://example.com/imt-certificate.webp",
      degreeImage: "",
    });

    expect(resolvePremiumProgramMedia({
      slug: "generative-ai-mastery-certificate-for-content-creation-microsoft",
      hero_image: "https://example.com/full-size-microsoft-hero.webp",
    }).heroImage).toBe("https://example.com/full-size-microsoft-hero.webp");
  });

  it("contains all 60 audited programme records and only AWS-origin generated URLs", () => {
    expect(Object.keys(UPGRAD_PROGRAM_MEDIA)).toHaveLength(60);
    const urls = Object.values(UPGRAD_PROGRAM_MEDIA).flatMap((media) => Object.values(media));
    expect(urls.length).toBeGreaterThan(60);
    expect(urls.every((url) => url.startsWith(AWS_PROGRAMME_MEDIA_PREFIX))).toBe(true);
  });
});
