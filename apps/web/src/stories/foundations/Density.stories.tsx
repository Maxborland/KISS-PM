import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Density",
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj;

const rows = [
  { token: "--row-h-ultra", label: "Ultra · 24px", height: "var(--row-h-ultra)" },
  { token: "--row-h-compact", label: "Compact · 32px", height: "var(--row-h-compact)" },
  { token: "--row-h-cozy", label: "Cozy · 40px", height: "var(--row-h-cozy)" },
  { token: "—", label: "Free · по контенту", height: "auto" }
] as const;

function DensityShowcase() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="type-h1">Плотность строк</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Один dominant tier на экран. Операционные списки — compact; decision surfaces — cozy.
        </p>
      </header>
      <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-6">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[length:var(--text-sm)] font-medium text-[var(--text)]">{row.label}</span>
              {row.token !== "—" ? (
                <code className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{row.token}</code>
              ) : null}
            </div>
            <div
              className="flex items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-strong)] px-3 text-[length:var(--text-sm)] text-[var(--text)]"
              style={{ minHeight: row.height, height: row.height === "auto" ? undefined : row.height }}
            >
              Пример строки · MDS-39 · В работе
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Tiers: Story = {
  name: "Уровни плотности",
  render: () => <DensityShowcase />
};
