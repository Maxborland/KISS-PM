import { z } from "zod";
import { sanitizeOptionalText, sanitizeText } from "./sanitize";
import { isConsumerEmailDomain, WORK_EMAIL_ERROR } from "./work-email";

/**
 * Public-facing waitlist submission schema. Trimmed, length-bounded, only
 * what is needed to qualify closed-alpha fit: person, company, role,
 * portfolio scale and short context.
 */

const boundedString = (min: number, max: number, msgMin: string) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, msgMin)
        .max(max, `Слишком длинно (макс. ${max} символов)`),
    );

const workEmail = z
  .string()
  .transform(sanitizeText)
  .pipe(z.string().toLowerCase())
  .pipe(z.string().min(1, "Укажите рабочий email"))
  .pipe(z.string().email("Похоже, в адресе опечатка"))
  .refine((addr) => !isConsumerEmailDomain(addr), { message: WORK_EMAIL_ERROR });

export const WaitlistSubmission = z.object({
  fullName: boundedString(2, 120, "Укажите имя и фамилию"),
  email: workEmail,
  company: boundedString(2, 120, "Укажите компанию"),
  role: boundedString(2, 80, "Укажите роль или должность"),
  companySize: z.enum(
    ["solo", "small", "mid", "large", "enterprise", "other"],
    { message: "Выберите диапазон проектов" },
  ),
  context: z
    .string()
    .transform(sanitizeOptionalText)
    .pipe(z.string().max(600, "Слишком длинно (макс. 600 символов)"))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  consent: z
    .union([z.literal(true), z.literal("on"), z.literal("true")], {
      message: "Нужно согласие с условиями альфы",
    })
    .transform(() => true)
    .pipe(z.literal(true)),
  /** Honeypot — should always be empty. */
  hp: z.preprocess(
    (v) => sanitizeText(String(v ?? "")),
    z.literal(""),
  ),
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

export function waitlistPayloadFromFormData(form: FormData): Record<string, unknown> {
  return Object.fromEntries(form.entries());
}

export function formatWaitlistIssues(
  issues: z.ZodError<WaitlistSubmissionInput>["issues"],
): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((acc, issue) => {
    const key = issue.path[0];
    if (typeof key !== "string") return acc;
    const list = acc[key] ?? [];
    if (issue.message) list.push(issue.message);
    acc[key] = list;
    return acc;
  }, {});
}
