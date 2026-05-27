import { z } from "zod";

/**
 * Public-facing waitlist submission schema. Trimmed, length-bounded, only
 * what is needed to qualify closed-alpha fit: person, company, role,
 * portfolio scale and short context. Marketing-only fields (utm_*) are
 * intentionally not collected to respect the KISS philosophy.
 */

const collapseSpaces = (s: string): string => s.replace(/\s+/g, " ");

const boundedString = (min: number, max: number, msgMin: string) =>
  z
    .string()
    .trim()
    .transform(collapseSpaces)
    .pipe(
      z
        .string()
        .min(min, msgMin)
        .max(max, `Слишком длинно (макс. ${max} символов)`),
    );

export const WaitlistSubmission = z.object({
  fullName: boundedString(2, 120, "Укажите имя и фамилию"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Похоже, в адресе опечатка"),
  company: boundedString(2, 120, "Укажите компанию"),
  role: boundedString(2, 80, "Укажите роль или должность"),
  companySize: z.enum([
    "solo",
    "small",
    "mid",
    "large",
    "enterprise",
    "other",
  ]),
  context: z
    .string()
    .trim()
    .transform(collapseSpaces)
    .pipe(z.string().max(600, "Слишком длинно (макс. 600 символов)"))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  consent: z
    .union([z.literal(true), z.literal("on"), z.literal("true")])
    .transform(() => true)
    .pipe(z.literal(true)),
  /** Honeypot — should always be empty. */
  hp: z.string().max(0).optional().or(z.literal("")),
});

export type WaitlistSubmissionInput = z.input<typeof WaitlistSubmission>;
export type WaitlistSubmissionParsed = z.output<typeof WaitlistSubmission>;

export const COMPANY_SIZE_LABELS: Record<WaitlistSubmissionParsed["companySize"], string> = {
  solo: "До 10 проектов",
  small: "10–30 проектов",
  mid: "30–50 проектов",
  large: "50–100 проектов",
  enterprise: "100+ проектов",
  other: "Другое",
};
