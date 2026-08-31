import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("OTP latency and entity logo regressions", () => {
  it("sends login OTP directly without the phone-auth relay", () => {
    const phoneAuth = read("src/lib/phoneAuth.ts");
    const requestFunction = phoneAuth.slice(
      phoneAuth.indexOf("export async function requestPhoneOtp"),
      phoneAuth.indexOf("export async function exchangePhoneOtpForSession"),
    );
    expect(phoneAuth).toContain('functionUrl("send-otp")');
    expect(requestFunction).toContain("fetch(SEND_OTP_URL");
    expect(requestFunction).not.toContain('functions.invoke("phone-auth"');
  });

  it("does not pin sends to one provider, allowing active-provider fallback", () => {
    for (const path of [
      "src/lib/phoneAuth.ts",
      "src/components/LeadInlineOtp.tsx",
      "src/components/LeadOtpVerify.tsx",
      "src/components/landing/ExamAdBlocks.tsx",
    ]) {
      expect(read(path)).not.toMatch(/provider_name:\s*"fast2sms"/);
    }
  });

  it("does not derive an auth password from the user's phone number", () => {
    const phoneAuthFunction = read("backend/src/auth.mjs");
    expect(phoneAuthFunction).toContain("randomInt(100000, 1000000)");
    expect(phoneAuthFunction).not.toContain("secure2026");
    expect(phoneAuthFunction).not.toContain("passwordForPhone");
  });

  it("requires the active MySQL Fast2SMS provider and AWS-injected credential in production", () => {
    const auth = read("backend/src/auth.mjs");
    expect(auth).toContain('provider_name: "fast2sms", channel: "sms", is_active: true');
    expect(auth).toContain("process.env.SMS_FAST2SMS_API_KEY");
    expect(auth).toContain('process.env.NODE_ENV === "production"');
    expect(auth).toContain('code: "SMS_NOT_CONFIGURED"');
  });

  it("uses contained logo-first images in college comparison and exam cards", () => {
    const collegeDetail = read("src/pages/CollegeDetail.tsx");
    expect(collegeDetail).not.toContain("enabled: !!collegeRelationSlug && coursesOfficiallyVerified");
    const examCard = read("src/components/ExamCard.tsx");
    expect(collegeDetail).toContain("src={c.logo || c.image}");
    expect(collegeDetail).toContain("aspect-square");
    expect(collegeDetail).toContain("object-contain");
    expect(examCard).toContain("src={exam.logo || exam.image}");
    expect(examCard).toContain("object-contain");
  });

  it("keeps logo padding independent from the surrounding card width", () => {
    const styles = read("src/index.css");
    const logoRule = styles.slice(styles.indexOf(".entity-logo-safe"), styles.indexOf(".entity-logo-safe") + 420);
    expect(logoRule).toContain("--entity-logo-padding, 0.375rem");
    expect(logoRule).not.toMatch(/padding:\s*\d+%/);
  });
});
