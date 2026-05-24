import type { Meta, StoryObj } from "@storybook/react";

const swatches = [
  { name: "accent", var: "--accent" },
  { name: "accent-hover", var: "--accent-hover" },
  { name: "accent-soft", var: "--accent-soft" },
  { name: "text", var: "--text" },
  { name: "text-strong", var: "--text-strong" },
  { name: "muted", var: "--muted" },
  { name: "muted-strong", var: "--muted-strong" },
  { name: "panel", var: "--panel" },
  { name: "panel-strong", var: "--panel-strong" },
  { name: "panel-elevated", var: "--panel-elevated" },
  { name: "border", var: "--border" },
  { name: "border-strong", var: "--border-strong" },
  { name: "success", var: "--success" },
  { name: "success-soft", var: "--success-soft" },
  { name: "warning", var: "--warning" },
  { name: "warning-soft", var: "--warning-soft" },
  { name: "danger", var: "--danger" },
  { name: "danger-soft", var: "--danger-soft" },
  { name: "info", var: "--info" },
  { name: "info-soft", var: "--info-soft" },
  { name: "violet", var: "--violet" },
  { name: "violet-soft", var: "--violet-soft" }
];

function ColorsPalette() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[var(--text-xl)] font-semibold text-[var(--text)]">Палитра design-v3</h1>
        <p className="text-[var(--text-sm)] text-[var(--muted)]">
          Токены из <code>styles/tokens.css</code> — согласование перед экранами Phase 2.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {swatches.map((s) => (
          <div
            key={s.var}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-3"
          >
            <div
              className="size-10 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)]"
              style={{ background: `var(${s.var})` }}
            />
            <div>
              <div className="text-[var(--text-sm)] font-medium text-[var(--text)]">{s.name}</div>
              <div className="font-mono text-[var(--text-xs)] text-[var(--muted)]">{s.var}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Colors",
  parameters: { layout: "fullscreen" }
};

export default meta;
type Story = StoryObj;

export const Palette: Story = {
  render: () => <ColorsPalette />
};
