import type { Meta, StoryObj } from "@storybook/react";

function TypographyScale() {
  const rows = [
    { label: "text-xs", cls: "text-[var(--text-xs)]" },
    { label: "text-sm", cls: "text-[var(--text-sm)]" },
    { label: "text-base", cls: "text-[var(--text-base)]" },
    { label: "text-lg", cls: "text-[var(--text-lg)]" },
    { label: "text-xl", cls: "text-[var(--text-xl)]" },
    { label: "text-2xl", cls: "text-[var(--text-2xl)]" }
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-[var(--text-xl)] font-semibold">Типографика</h1>
        <p className="text-[var(--text-sm)] text-[var(--muted)]">Шкала размеров и начертания для UI KISS PM.</p>
      </header>
      <section className="space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3">
            <span className="font-mono text-[var(--text-xs)] text-[var(--muted)]">{r.label}</span>
            <p className={`${r.cls} text-[var(--text)]`}>Управление проектами и ресурсами</p>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <p className="text-[var(--text-sm)] font-medium text-[var(--text)]">Semibold заголовок</p>
        <p className="text-[var(--text-sm)] text-[var(--muted)]">Обычный вторичный текст</p>
        <p className="text-[var(--text-xs)] text-[var(--muted-strong)]">Подпись / hint</p>
      </section>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj;

export const Scale: Story = {
  render: () => <TypographyScale />
};
