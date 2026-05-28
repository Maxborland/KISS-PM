import type { Meta, StoryObj } from "@storybook/react";

/**
 * Storybook-facing слой: краткая выжимка. Canonical docs — docs/design-v3/*.md в репозитории.
 */
const DOC_LINKS = [
  {
    title: "Критерии качества",
    path: "docs/design-v3/PRODUCTION-GRADE-BRIEF.md",
    lead: "Цель, блокеры, фазы и границы работ."
  },
  {
    title: "Контракт дизайна",
    path: "docs/design-v3/DESIGN_CONTRACT.md",
    lead: "Обязательные правила UI, Storybook, плотности, глубины и акцентов."
  },
  {
    title: "Токены",
    path: "docs/design-v3/TOKENS.md",
    lead: "Палитра, типографика, отступы и изменения токенов."
  },
  {
    title: "Структура Storybook",
    path: "docs/design-v3/STORYBOOK-STRUCTURE.md",
    lead: "Восемь разделов, правила группировки и миграция каталога."
  },
  {
    title: "Границы первых фаз",
    path: "docs/design-v3/PHASE-0-1-SCOPE-BOUNDARY.md",
    lead: "Что входит в каталог, а что остаётся в API- и task-контрактах."
  }
] as const;

function DesignContractOverview() {
  return (
    <div className="space-y-8 p-6 max-w-[880px]">
      <header>
        <p
          className="mb-2 text-[length:var(--text-eyebrow)] font-semibold uppercase tracking-[var(--letter-eyebrow)] text-[var(--muted-strong)]"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          Foundations · обзор
        </p>
        <h1 className="type-h1">Контракт design-v3</h1>
        <p className="type-body mt-3 text-[var(--muted)]">
          Storybook показывает визуальные примеры: цвета, типографику, плотность, глубину и иконки. Полные
          спецификации и планы — в каталоге <code className="mono text-[length:var(--text-sm)]">docs/design-v3/</code>{" "}
          в git, не дублируются на тысячи строк здесь.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="type-h3">Быстрые правила</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 type-body text-[var(--text)]">
          <li>Текст продукта и Storybook — русский; API, типы и идентификаторы остаются на английском.</li>
          <li>
            Экраны — готовый рабочий контекст 1440px, без служебных ошибок Storybook внутри продукта.
          </li>
          <li>
            Sidebar держит ровно восемь корневых разделов; видимые названия историй и групп — русские.
          </li>
          <li>
            <code className="mono text-[length:var(--text-xs)]">--brand-grad</code> — только акцентные поверхности, не
            фон приложения.
          </li>
          <li>Плотность: ultra 24px · compact 32px · cozy 40px — один dominant tier на экран.</li>
        </ul>
      </section>

      <section>
        <h2 className="type-h3">Документы в репозитории</h2>
        <p className="type-body mt-2 text-[var(--muted)]">
          Откройте файл в IDE по пути от корня worktree (не URL в браузере).
        </p>
        <ul className="mt-4 space-y-3">
          {DOC_LINKS.map((doc) => (
            <li
              key={doc.path}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-4"
            >
              <div className="text-[length:var(--text-sm)] font-semibold text-[var(--text)]">{doc.title}</div>
              <code className="mono mt-1 block text-[length:var(--text-xs)] text-[var(--accent)]">{doc.path}</code>
              <p className="mt-2 text-[length:var(--text-sm)] text-[var(--muted)]">{doc.lead}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
        <h2 className="type-h3">Визуальные Foundations рядом</h2>
        <p className="type-body mt-2 text-[var(--muted)]">
          Цвета, типографика, плотность, глубина и иконки — в той же группе «Основы».
        </p>
      </section>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Контракт дизайна",
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;
type Story = StoryObj;

export const Overview: Story = {
  name: "Обзор и ссылки на документы",
  render: () => <DesignContractOverview />
};
