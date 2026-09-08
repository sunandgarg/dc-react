import { describe, expect, it } from "vitest";
import { safeEmbedUrl, safeHttpUrl } from "@/lib/safeExternalUrl";

describe("safeExternalUrl", () => {
  it("allows ordinary HTTP links and rejects active protocols", () => {
    expect(safeHttpUrl("https://example.edu/path")).toBe("https://example.edu/path");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("allows only trusted HTTPS embed hosts", () => {
    expect(safeEmbedUrl("https://www.youtube.com/embed/abc")).toBe("https://www.youtube.com/embed/abc");
    expect(safeEmbedUrl("https://evil.example/embed/abc")).toBeNull();
    expect(safeEmbedUrl("http://www.youtube.com/embed/abc")).toBeNull();
  });
});
