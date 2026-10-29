import { afterEach, describe, expect, it, vi } from "vitest";
import { saveLeadPhase } from "./twoStepLead";

afterEach(() => vi.unstubAllGlobals());
describe("durable lead acknowledgement", () => {
  it.each([{ success: false }, { success: true }, {}])("rejects incomplete acknowledgements %j", async body => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    await expect(saveLeadPhase({ phase: "complete" })).rejects.toThrow();
  });
  it("accepts a saved lead", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, lead_id: "saved", phase: "complete" }) }));
    await expect(saveLeadPhase({ phase: "complete" })).resolves.toMatchObject({ lead_id: "saved" });
  });
});
