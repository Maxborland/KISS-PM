export type SetupStep = {
  id: "task" | "deal" | "project";
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function buildSetupSteps(input: {
  permissions: string[];
  taskCount: number | null;
  opportunityCount: number | null;
  projectCount: number | null;
  /** id первого активного проекта — цель прямой ссылки на расписание (null, если проектов нет/не загрузились). */
  firstProjectId: string | null;
}): SetupStep[] {
  const permissions = new Set(input.permissions);
  const steps: SetupStep[] = [];

  /* Р7: раньше шаг вёл на /my-work, где создать задачу НЕЛЬЗЯ (там только
     работа с назначенными). Фактическая поверхность создания — расписание
     проекта (/projects/[id]/schedule: строка «Новая задача», контекстное
     «Создать задачу рядом»). Поэтому:
     - есть проект → прямо в его расписание (fallback — список проектов);
     - проектов нет → сначала активировать проект из сделки (/crm/deals),
       как и предыдущие шаги цепочки; без прав на активацию шаг не обещаем;
     - проекты не загрузились/недоступны (projectCount === null) — шаг не
       показываем: честного маршрута к созданию нет. */
  if (permissions.has("tenant.tasks.create") && input.taskCount !== null && input.projectCount !== null) {
    const hasProject = input.projectCount > 0;
    const canActivateProject =
      permissions.has("tenant.opportunities.manage") && permissions.has("tenant.projects.manage");
    if (hasProject || canActivateProject) {
      steps.push({
        id: "task",
        label: "Создать первую задачу",
        description: hasProject
          ? "Откройте расписание проекта и зафиксируйте ближайшее действие и ответственного."
          : "Сначала активируйте проект из подтверждённой сделки — задачи создаются в его расписании.",
        href: hasProject
          ? input.firstProjectId
            ? `/projects/${input.firstProjectId}/schedule`
            : "/projects"
          : "/crm/deals",
        done: input.taskCount > 0
      });
    }
  }
  if (permissions.has("tenant.opportunities.manage") && input.opportunityCount !== null) {
    steps.push({
      id: "deal",
      label: "Создать первую сделку",
      description: "Добавьте клиента и проведите возможность по готовой воронке.",
      href: "/crm/deals",
      done: input.opportunityCount > 0
    });
  }
  if (
    permissions.has("tenant.opportunities.manage") &&
    permissions.has("tenant.projects.manage") &&
    input.projectCount !== null
  ) {
    steps.push({
      id: "project",
      label: "Активировать первый проект",
      description: "Проверьте осуществимость сделки и создайте проект из подтверждённой возможности.",
      href: "/crm/deals",
      done: input.projectCount > 0
    });
  }

  return steps;
}
