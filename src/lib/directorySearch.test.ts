import { beforeEach, describe, expect, it, vi } from "vitest";
import identities from "../../shared/exam-identities.json";
import { clearDirectorySearchCache, resolveDirectoryMediaUrl, searchDirectory } from "./directorySearch";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/backend/client", () => ({ backendClient: { rpc, from } }));

describe("exam directory branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDirectorySearchCache();
  });

  it("keeps reviewed frontend assets out of the AWS storage resolver", () => {
    expect(resolveDirectoryMediaUrl(identities["cseet-icsi"].logo)).toBe(identities["cseet-icsi"].logo);
    expect(resolveDirectoryMediaUrl("admin-uploads/custom.webp")).toContain("/storage/v1/object/public/admin-uploads/custom.webp");
  });

  it("uses the same reviewed logo for every catalog exam in RPC search results", async () => {
    rpc.mockResolvedValue({ data: Object.entries(identities).map(([slug, identity]) => ({
      entity_type: "Exam", slug, name: identity.short_name,
      logo_url: `/exam-logos-v2/${slug}.webp`, image_url: "/unrelated-banner.webp",
    })), error: null });
    const results = await searchDirectory("exam");
    expect(results).toHaveLength(Object.keys(identities).length);
    for (const result of results) {
      const identity = identities[result.slug as keyof typeof identities];
      expect(result.logo_url).toBe(identity.logo);
      expect(result.image_url).toBe(identity.logo);
      expect(result.logo_url).not.toContain("exam-logos-v2");
    }
  });

  it("does not run broad catalog scans when the search endpoint fails", async () => {
    rpc.mockResolvedValue({ error: new Error("RPC unavailable") });
    await expect(searchDirectory("cseet")).rejects.toThrow("RPC unavailable");
    expect(from).not.toHaveBeenCalled();
  });

  it("retains custom exam logos and leaves unknown exams without invented logos", async () => {
    rpc.mockResolvedValue({ data: [
      { entity_type: "Exam", slug: "cseet-icsi", logo_url: "https://example.com/custom.webp" },
      { entity_type: "Exam", slug: "new-exam", image_url: "https://example.com/banner.webp" },
    ], error: null });
    const results = await searchDirectory("exam");
    expect(results.find((row) => row.slug === "cseet-icsi")?.logo_url).toBe("https://example.com/custom.webp");
    expect(results.find((row) => row.slug === "new-exam")).toMatchObject({ logo_url: "", image_url: "" });
  });
});
