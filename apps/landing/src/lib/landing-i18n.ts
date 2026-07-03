export type LandingLocale = "ru" | "en";

export type LandingFaq = {
  q: string;
  a: string;
};

export const landingLocales = ["ru", "en"] as const;

export const landingCopy = {
  ru: {
    lang: "ru",
    siteUrl: "https://kisspm.app/",
    canonicalPath: "/",
    title: "KISS PM — управление проектами как код",
    description:
      "KISS PM — agent-first управление проектами как код: опишите цель, получите сверку изменений по задачам, срокам и ресурсам, примените выбранное с аудитом.",
    skipLink: "Перейти к содержимому",
    offerDescription: "Закрытая альфа по заявке.",
    alternates: [
      { hrefLang: "ru", href: "https://kisspm.app/" },
      { hrefLang: "en", href: "https://kisspm.app/en/" },
      { hrefLang: "x-default", href: "https://kisspm.app/" },
    ],
    header: {
      navLabel: "Навигация по разделам",
      brandHref: "/",
      items: [
        { href: "#agent-demo", label: "Агент", id: "agent-demo" },
        { href: "#loop", label: "Как работает", id: "loop" },
        { href: "#demo", label: "Сценарий", id: "demo" },
        { href: "#faq", label: "Вопросы", id: "faq" },
        { href: "#waitlist", label: "Ранний доступ", id: "waitlist" },
      ],
      cta: "Запросить доступ",
      localeHref: "/en/",
      localeLabel: "EN",
    },
    hero: {
      title: ["Управление проектами.", "Переосмыслено."],
      copy:
        "Проект меняется как код: агент готовит сверку по задачам, срокам и ресурсам. Вы применяете только выбранное.",
      cta: "Запросить доступ",
    },
    philosophy: {
      title: "Keep it simple. Seriously.",
      lines: [
        "Вы описываете, что нужно изменить в проекте.",
        "Агент показывает сверку: что было и что станет.",
        "Человек применяет выбранное, аудит сохраняет решение.",
      ],
    },
    sixSteps: {
      ariaLabel: "От цели к проверяемому изменению KISS PM",
      title: "От цели к проверяемому изменению",
      cta: "Запросить доступ",
      progressLabel: "Навигация по шагам",
      progressItemLabel: "Перейти к шагу",
    },
    demoSection: {
      title: "Интерактивный сценарий",
      copy: "Живой пример: цель превращается в сверку изменений проекта — задачи, сроки, ресурсы, применение и аудит.",
    },
    faqTitle: "Вопросы",
    waitlist: {
      title: "Ранний доступ",
      copy:
        "Закрытая альфа для команд, которые хотят управлять проектами через агента, а не собирать статус и правки вручную. Оставьте рабочую почту — ответим письмом.",
    },
    footer: {
      topLabel: "KISS PM — наверх",
      tag: "Агент готовит сверку изменений проекта. Человек применяет выбранное, KISS PM пишет аудит.",
      landingHeading: "Лендинг",
      docsHeading: "Документы",
      productLinks: [
        { href: "#agent-demo", label: "Агент" },
        { href: "#loop", label: "Как работает" },
        { href: "#demo", label: "Сценарий" },
        { href: "#waitlist", label: "Ранний доступ" },
      ],
      legalLinks: [
        { href: "/privacy", label: "Конфиденциальность" },
        { href: "/terms", label: "Условия альфы" },
      ],
      status: "Закрытая альфа",
    },
  },
  en: {
    lang: "en",
    siteUrl: "https://kisspm.app/en/",
    canonicalPath: "/en/",
    title: "KISS PM — agent-first project management as code",
    description:
      "KISS PM is agent-first project management as code: describe the goal, review a project diff across tasks, dates and resources, then apply only what you approve.",
    skipLink: "Skip to content",
    offerDescription: "Closed alpha by request.",
    alternates: [
      { hrefLang: "ru", href: "https://kisspm.app/" },
      { hrefLang: "en", href: "https://kisspm.app/en/" },
      { hrefLang: "x-default", href: "https://kisspm.app/" },
    ],
    header: {
      navLabel: "Landing sections",
      brandHref: "/en/",
      items: [
        { href: "#agent-demo", label: "Agent", id: "agent-demo" },
        { href: "#loop", label: "How it works", id: "loop" },
        { href: "#demo", label: "Scenario", id: "demo" },
        { href: "#faq", label: "FAQ", id: "faq" },
        { href: "#waitlist", label: "Early access", id: "waitlist" },
      ],
      cta: "Request access",
      localeHref: "/",
      localeLabel: "RU",
    },
    hero: {
      title: ["Project management.", "Reimagined."],
      copy:
        "Your project changes like code: the agent prepares a diff across tasks, dates and resources. You apply only what you approve.",
      cta: "Request access",
    },
    philosophy: {
      title: "Keep it simple. Seriously.",
      lines: [
        "Describe what needs to change in the project.",
        "The agent shows a diff: what changes and why.",
        "People approve the decision, KISS PM keeps the audit trail.",
      ],
    },
    sixSteps: {
      ariaLabel: "From goal to approved project change in KISS PM",
      title: "From goal to approved change",
      cta: "Request access",
      progressLabel: "Step navigation",
      progressItemLabel: "Go to step",
    },
    demoSection: {
      title: "Interactive scenario",
      copy: "A live example: a goal becomes a project diff across tasks, dates, resources, approval and audit.",
    },
    faqTitle: "FAQ",
    waitlist: {
      title: "Early access",
      copy:
        "Closed alpha for teams that want to manage projects through an agent instead of collecting status and edits by hand. Leave a work email — we will reply by email.",
    },
    footer: {
      topLabel: "KISS PM — back to top",
      tag: "The agent prepares a project diff. People apply what they approve, KISS PM writes the audit trail.",
      landingHeading: "Landing",
      docsHeading: "Docs",
      productLinks: [
        { href: "#agent-demo", label: "Agent" },
        { href: "#loop", label: "How it works" },
        { href: "#demo", label: "Scenario" },
        { href: "#waitlist", label: "Early access" },
      ],
      legalLinks: [
        { href: "/en/privacy/", label: "Privacy" },
        { href: "/en/terms/", label: "Alpha terms" },
      ],
      status: "Closed alpha",
    },
  },
} as const;

export function copyFor(locale: LandingLocale) {
  return landingCopy[locale];
}