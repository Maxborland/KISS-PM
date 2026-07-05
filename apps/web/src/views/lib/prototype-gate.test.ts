import { afterEach, describe, expect, it, vi } from "vitest";

// Регресс BUG-014: прототип-заметки скрыты по умолчанию (прод), включаются только явным флагом.
describe("prototypeNotesEnabled", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES;
  });

  it("is false by default (production build has no flag)", async () => {
    delete process.env.NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES;
    vi.resetModules();
    const { prototypeNotesEnabled } = await import("./prototype-gate");
    expect(prototypeNotesEnabled).toBe(false);
  });

  it("is true only when explicitly enabled for Storybook/demo", async () => {
    process.env.NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES = "true";
    vi.resetModules();
    const { prototypeNotesEnabled } = await import("./prototype-gate");
    expect(prototypeNotesEnabled).toBe(true);
  });

  it("treats any non-\"true\" value as disabled", async () => {
    process.env.NEXT_PUBLIC_KISS_PM_PROTOTYPE_NOTES = "1";
    vi.resetModules();
    const { prototypeNotesEnabled } = await import("./prototype-gate");
    expect(prototypeNotesEnabled).toBe(false);
  });
});
