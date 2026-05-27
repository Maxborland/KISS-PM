import { describe, expect, it } from "vitest";
import { WaitlistSubmission } from "./schema";

describe("WaitlistSubmission", () => {
  const base = {
    fullName: "  Анна  Каренина  ",
    email: "  Anna@Example.COM  ",
    company: "  Север  Девелопмент  ",
    role: "PMO Lead",
    companySize: "mid" as const,
    consent: "on" as const,
  };

  it("trims, normalises, and accepts a valid submission", () => {
    const parsed = WaitlistSubmission.parse(base);
    expect(parsed.fullName).toBe("Анна Каренина");
    expect(parsed.email).toBe("anna@example.com");
    expect(parsed.company).toBe("Север Девелопмент");
    expect(parsed.consent).toBe(true);
  });

  it("rejects missing consent", () => {
    const result = WaitlistSubmission.safeParse({ ...base, consent: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects malformed email", () => {
    const result = WaitlistSubmission.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects honeypot filled", () => {
    const result = WaitlistSubmission.safeParse({ ...base, hp: "spam" });
    expect(result.success).toBe(false);
  });

  it("strips empty optional context", () => {
    const parsed = WaitlistSubmission.parse({ ...base, context: "" });
    expect(parsed.context).toBeUndefined();
  });

  it("rejects bad company size enum", () => {
    const result = WaitlistSubmission.safeParse({
      ...base,
      companySize: "huge" as unknown as "mid",
    });
    expect(result.success).toBe(false);
  });
});
