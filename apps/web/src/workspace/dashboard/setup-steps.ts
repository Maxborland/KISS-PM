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
}): SetupStep[] {
  const permissions = new Set(input.permissions);
  const steps: SetupStep[] = [];

  if (permissions.has("tenant.tasks.create") && input.taskCount !== null) {
    steps.push({
      id: "task",
      label: "Создать первую задачу",
      description: "Зафиксируйте ближайшее действие и ответственного.",
      href: "/my-work",
      done: input.taskCount > 0
    });
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
