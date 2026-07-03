import type { LandingFaq, LandingLocale } from "./landing-i18n";

export const faqsByLocale: Record<LandingLocale, ReadonlyArray<LandingFaq>> = {
  ru: [
    {
      q: "Это очередной таск-трекер?",
      a: "Нет. KISS PM не про «доски с задачами». Это agent-first управление проектами как код: вы описываете цель, получаете сверку изменений по задачам, срокам и ресурсам, а затем применяете выбранное.",
    },
    {
      q: "Чем KISS PM отличается от Jira / Bitrix / MS Project?",
      a: "Jira, Bitrix и MS Project сильны в отдельных зонах: задачи, CRM или диаграмма Ганта. KISS PM соединяет CRM и проекты в одной системе и делает изменения проверяемыми: сначала сверка, потом применение и аудит.",
    },
    {
      q: "Что значит «управление проектами как код»?",
      a: "Это не про программирование. Это про управляемые изменения: агент читает контекст проекта, предлагает конкретные правки, показывает сверку «было / стало», а человек применяет только разрешенные действия.",
    },
    {
      q: "Что значит «закрытая альфа»?",
      a: "Мы открываем продукт небольшим командам, которым нужно быстрее принимать решения по проектам, ресурсам и срокам. Без массового набора, холодных звонков и рассылок. Участие бесплатно в обмен на честную обратную связь.",
    },
    {
      q: "Нужна ли отдельная команда внедрения?",
      a: "Нет. Настройки рабочей области покрывают роли, KPI, стадии и поля без кода. Онбординг и шаблоны проектов — часть продукта. Если нужна помощь, мы подключимся, но это не годовой проект внедрения.",
    },
    {
      q: "SaaS или self-hosted?",
      a: "Оба варианта заложены с первого дня. Ядро домена остается одинаковым, отличаются инфраструктура и хранение данных. CRM, Jira, Slack и email — интеграционные адаптеры, не ядро KISS PM.",
    },
    {
      q: "Когда будет публичный запуск?",
      a: "После того, как закрытая альфа пройдет несколько команд разного масштаба и стабилизируются работа агента, сверка изменений, права и аудит. Дата зависит от обратной связи участников, а не от пресс-релиза.",
    },
  ],
  en: [
    {
      q: "Is this another task tracker?",
      a: "No. KISS PM is not about boards with tasks. It is agent-first project management as code: describe the goal, review a project diff across tasks, dates and resources, then apply only what you approve.",
    },
    {
      q: "How is KISS PM different from Jira, Bitrix or MS Project?",
      a: "Jira, Bitrix and MS Project are strong in separate zones: tasks, CRM or Gantt planning. KISS PM connects CRM and projects in one system and makes every important change reviewable: diff first, approval second, audit always.",
    },
    {
      q: "What does project management as code mean?",
      a: "It does not mean your team has to write code. It means project changes are explicit, reviewable and auditable: the agent reads context, proposes concrete edits, shows a before/after diff, and a person applies only permitted actions.",
    },
    {
      q: "What does closed alpha mean?",
      a: "We are opening the product to a small number of teams that need faster decisions around projects, resources and dates. No mass rollout, no cold calls, no newsletters. Participation is free in exchange for honest feedback.",
    },
    {
      q: "Do we need an implementation team?",
      a: "No. Workspace settings cover roles, KPIs, stages and fields without custom code. Onboarding and project templates are part of the product. We can help if needed, but this is not a year-long implementation project.",
    },
    {
      q: "SaaS or self-hosted?",
      a: "Both paths are planned from day one. The domain core stays the same; infrastructure and data storage differ. CRM, Jira, Slack and email are adapters, not the KISS PM core.",
    },
    {
      q: "When will the public launch happen?",
      a: "After the closed alpha runs with several teams of different scale and the agent, project diff, permissions and audit flows stabilize. The date depends on alpha feedback, not on a press release.",
    },
  ],
};

export const faqs = faqsByLocale.ru;