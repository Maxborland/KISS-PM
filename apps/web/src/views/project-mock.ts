/** Согласованное RU-имя mock-проекта (§1 DESIGN_CONTRACT). */
export const MOCK_PROJECT_CRM = "Внедрение CRM";

export function mockTaskProjectRef(taskCode: string): string {
  return `${taskCode} · ${MOCK_PROJECT_CRM}`;
}

export function mockProjectScreenTitle(suffix: string): string {
  return `${suffix} · ${MOCK_PROJECT_CRM}`;
}
