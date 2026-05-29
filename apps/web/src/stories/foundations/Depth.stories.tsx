import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Depth",
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj;

const tiers = [
  {
    id: "flat",
    label: "Flat",
    lead: "Только граница, без тени",
    className: "border border-[var(--border)] bg-[var(--panel)] shadow-none"
  },
  {
    id: "resting",
    label: "Resting",
    lead: "Карточка по умолчанию",
    className: "border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]"
  },
  {
    id: "elevated",
    label: "Elevated",
    lead: "Подпанели, sticky blocks",
    className: "border border-[var(--border)] bg-[var(--panel-elevated)] shadow-[var(--shadow-panel)]"
  },
  {
    id: "floating",
    label: "Floating",
    lead: "Command, overlay, modal layer",
    className: "border border-[var(--border-strong)] bg-[var(--panel)] shadow-[var(--shadow-floating)]"
  }
] as const;

function DepthShowcase() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="type-h1">Глубина поверхностей</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Не ставить floating-тень на каждую строку таблицы — только transient слои.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {tiers.map((t) => (
          <div key={t.id} className={`rounded-[var(--radius-lg)] p-5 ${t.className}`}>
            <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--letter-eyebrow)] text-[var(--muted-strong)]">
              {t.label}
            </div>
            <p className="mt-2 text-[length:var(--text-sm)] text-[var(--text)]">{t.lead}</p>
            <p className="mt-3 type-body text-[var(--muted)]">Контент панели остаётся 14px — меняется только elevation.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Tiers: Story = {
  name: "Уровни глубины",
  render: () => <DepthShowcase />
};
