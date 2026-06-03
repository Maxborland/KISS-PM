export const betaRuntimeRoutes = [
  { path: "/dashboard", marker: "Живая сводка по проектам" },
  { path: "/my-work", marker: "Моя работа" },
  { path: "/agent", marker: "Генри Гантт" },
  { path: "/projects", marker: "Проекты" },
  { path: "/projects/project-beta-school-renovation", marker: "Школа на 600 мест" },
  { path: "/projects/project-beta-school-renovation/timeline", marker: "Обмерить существующие классы" },
  { path: "/projects/project-beta-school-renovation/resources", marker: "Ресурсная загрузка" },
  { path: "/deals", marker: "Сделки" },
  { path: "/directories/clients", marker: "Клиенты" },
  { path: "/directories/contacts", marker: "Контакты" },
  { path: "/directories/products", marker: "Продукты" },
  { path: "/admin/audit", marker: "Аудит действий" },
  { path: "/admin/roles", marker: "Роли" },
  { path: "/admin/users", marker: "Пользователи" }
];

export const betaRuntimeRoutePaths = betaRuntimeRoutes.map((route) => route.path);
export const defaultFastPrGateRoutes = betaRuntimeRoutePaths.join(",");
