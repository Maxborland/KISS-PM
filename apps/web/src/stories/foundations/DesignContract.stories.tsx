import type { Meta, StoryObj } from "@storybook/react";

/**
 * Storybook-facing слой: краткая выжимка. Canonical docs — docs/design-v3/*.md в репозитории.
 */
const DOC_LINKS = [
  {
    title: "Production-grade brief",
    path: "docs/design-v3/PRODUCTION-GRADE-BRIEF.md",
    lead: "Цель, blockers, фазы, scope PR."
  },
  {
    title: "Design contract",
    path: "docs/design-v3/DESIGN_CONTRACT.md",
    lead: "Enforceable правила UI, Storybook, density/depth/gradient."
  },
  {
    title: "Tokens",
    path: "docs/design-v3/TOKENS.md",
    lead: "Reconciliation и Phase 1 token deltas."
  },
  {
    title: "Storybook structure",
    path: "docs/design-v3/STORYBOOK-STRUCTURE.md",
    lead: "Подготовка 8 секций (inventory, globs, миграция) — внедрение Phase 8."
  },
  {
    title: "Phase 0–1 scope",
    path: "docs/design-v3/PHASE-0-1-SCOPE-BOUNDARY.md",
    lead: "Что входит в Storybook PR, что вынести (API, task-contract)."
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
          Storybook показывает визуальные примеры (Colors, Typography, Density, Depth, Iconography). Полные
          спецификации и планы — в каталоге <code className="mono text-[length:var(--text-sm)]">docs/design-v3/</code>{" "}
          в git, не дублируются на тысячи строк здесь.
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
        <h2 className="type-h3">Быстрые правила</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 type-body text-[var(--text)]">
          <li>UI copy — русский; API/types/identifiers — English.</li>
          <li>
            Product screens (<code className="mono text-[length:var(--text-xs)]">Views/Screens</code>) — готовый экран
            1440px, без Storybook error UI.
          </li>
          <li>
            Корни sidebar (<code className="mono text-[length:var(--text-xs)]">Foundations</code>,{" "}
            <code className="mono text-[length:var(--text-xs)]">UI</code>, …) — system English до Phase 8; имена
            stories (<code className="mono text-[length:var(--text-xs)]">name</code>) — RU.
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
          Colors · Typography · Density · Depth · Iconography — в той же группе Foundations в sidebar.
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
  name: "Обзор и ссылки на docs",
  render: () => <DesignContractOverview />
};
