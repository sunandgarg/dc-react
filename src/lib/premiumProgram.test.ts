import { describe, expect, it } from "vitest";
import { isIitIimProgram, resolvePremiumProgramMedia } from "@/lib/premiumProgram";
import { UPGRAD_PROGRAM_MEDIA } from "@/lib/upgradProgramMedia.generated";
import { UPGRAD_PROGRAM_CERTIFICATE_MEDIA } from "@/lib/upgradProgramCertificateMedia.generated";

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
    const slug = "executive-post-graduate-certificate-in-building-ai-products-systems-and-services-iit-kharagpur-iit-kharagpur";
    const resolved = resolvePremiumProgramMedia({
      slug,
      hero_image: "https://example.com/generic-cover.webp",
      institute_logo: "https://example.com/generic-logo.webp",
      certificate_image: "https://example.com/generic-certificate.webp",
      degree_image: "https://example.com/degree.webp",
    });

    expect(resolved).toEqual({
      cardImage: "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/media-library/1789919914234-ua4doe.webp",
      detailHeroImage: UPGRAD_PROGRAM_MEDIA[slug].heroImage,
      heroImage: UPGRAD_PROGRAM_MEDIA[slug].heroImage,
      instituteLogo: expect.stringMatching(/^https:\/\/aws-origin\.dekhocampus\.com\//),
      certificateImage: UPGRAD_PROGRAM_CERTIFICATE_MEDIA[slug].certificateImage,
      degreeImage: "",
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
      cardImage: "https://example.com/hero.webp",
      detailHeroImage: "https://example.com/hero.webp",
      heroImage: "https://example.com/hero.webp",
      instituteLogo: "https://example.com/logo.webp",
      certificateImage: "https://example.com/certificate.webp",
      degreeImage: "https://example.com/degree.webp",
    });
  });

  it("does not display an unverified degree fallback for IIT/IIM programmes", () => {
    const resolved = resolvePremiumProgramMedia({
      slug: "unmapped-iit-programme",
      college_name: "IIT Delhi",
      hero_image: "https://example.com/hero.webp",
      certificate_image: "https://example.com/certificate.webp",
      degree_image: "https://example.com/unverified-degree.webp",
    });

    expect(resolved.certificateImage).toBe("");
    expect(resolved.degreeImage).toBe("");
  });

  it("falls back to database media for assets excluded by quality review", () => {
    expect(resolvePremiumProgramMedia({
      slug: "advanced-general-management-program-from-imt-ghaziabad-imt-ghaziabad",
      hero_image: "https://example.com/imt-hero.webp",
      institute_logo: "https://example.com/imt-logo.webp",
      certificate_image: "https://example.com/imt-certificate.webp",
    })).toEqual({
      cardImage: "https://example.com/imt-hero.webp",
      detailHeroImage: "https://example.com/imt-hero.webp",
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

  it("uses programme art for details while keeping campus art on the 15 institute cards", () => {
    const resolved = resolvePremiumProgramMedia({
      slug: "professional-certificate-programme-in-ai-for-business-professionals-iim-kozhikode",
      hero_image: "https://example.com/database-hero.webp",
    });

    expect(resolved.cardImage).toContain("/media-library/1789919934865-kk6j2x.webp");
    expect(resolved.detailHeroImage).toContain("/media-library/");
    expect(resolved.cardImage).not.toBe(resolved.detailHeroImage);
    expect(resolved.heroImage).toBe(resolved.detailHeroImage);
  });

  it("contains all 60 audited programme records and only AWS-origin generated URLs", () => {
    expect(Object.keys(UPGRAD_PROGRAM_MEDIA)).toHaveLength(60);
    const urls = Object.values(UPGRAD_PROGRAM_MEDIA).flatMap((media) => Object.values(media));
    expect(urls.length).toBeGreaterThan(60);
    expect(urls.every((url) => url.startsWith(AWS_PROGRAMME_MEDIA_PREFIX))).toBe(true);
  });

  it("contains audited high-resolution upGrad certificate artwork for every mapped IIT/IIM certificate", () => {
    expect(Object.keys(UPGRAD_PROGRAM_CERTIFICATE_MEDIA)).toHaveLength(7);
    for (const media of Object.values(UPGRAD_PROGRAM_CERTIFICATE_MEDIA)) {
      expect(media.certificateImage).toMatch(/^\/assets\/programs\/iit-iim\/certificates\//);
      expect(media.width).toBe(3840);
      expect(media.height).toBeGreaterThan(0);
      expect(media.sourceUrl).toMatch(/(?:upgrad\.com|cloudfront\.net)/);
    }
  });
});
