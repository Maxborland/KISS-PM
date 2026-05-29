import type { Meta, StoryObj } from "@storybook/react";

import { bestTextContrast } from "@/stories/foundations/contrast";

type Swatch = {
  label: string;
  var: string;
  hex: string;
  swatchClass: string;
};

const swatches: Swatch[] = [
  { label: "Акцент", var: "--accent", hex: "#2563eb", swatchClass: "bg-[var(--accent)]" },
  { label: "Акцент при наведении", var: "--accent-hover", hex: "#1d4ed8", swatchClass: "bg-[var(--accent-hover)]" },
  { label: "Акцент (мягкий фон)", var: "--accent-soft", hex: "#eef4ff", swatchClass: "bg-[var(--accent-soft)]" },
  { label: "Основной текст", var: "--text", hex: "#0f172a", swatchClass: "bg-[var(--text)]" },
  { label: "Усиленный текст", var: "--text-strong", hex: "#020617", swatchClass: "bg-[var(--text-strong)]" },
  { label: "Приглушённый текст", var: "--muted", hex: "#64748b", swatchClass: "bg-[var(--muted)]" },
  { label: "Приглушённый текст (усил.)", var: "--muted-strong", hex: "#475569", swatchClass: "bg-[var(--muted-strong)]" },
  { label: "Холст", var: "--canvas", hex: "#eef0f4", swatchClass: "bg-[var(--canvas)]" },
  { label: "Панель", var: "--panel", hex: "#ffffff", swatchClass: "bg-[var(--panel)]" },
  { label: "Панель (усил.)", var: "--panel-strong", hex: "#f3f5f8", swatchClass: "bg-[var(--panel-strong)]" },
  { label: "Граница", var: "--border", hex: "#e6e8ee", swatchClass: "bg-[var(--border)]" },
  { label: "Успех", var: "--success", hex: "#10b981", swatchClass: "bg-[var(--success)]" },
  { label: "Предупреждение", var: "--warning", hex: "#f59e0b", swatchClass: "bg-[var(--warning)]" },
  { label: "Опасность", var: "--danger", hex: "#ef4444", swatchClass: "bg-[var(--danger)]" },
  { label: "Информация", var: "--info", hex: "#0ea5e9", swatchClass: "bg-[var(--info)]" },
  { label: "Фиолетовый", var: "--violet", hex: "#8b5cf6", swatchClass: "bg-[var(--violet)]" }
];

function ContrastChip({ hex }: { hex: string }) {
  const { ratio, badge, on } = bestTextContrast(hex);
  if (badge === "—") {
    return (
      <span className="rounded-[var(--radius-xs)] border border-[var(--border)] px-1.5 py-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">
        контраст {ratio.toFixed(1)}:1
      </span>
    );
  }
  return (
    <span
      className="rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium"
      style={{ backgroundColor: on, color: hex }}
    >
      {badge} · {ratio.toFixed(1)}:1
    </span>
  );
}

function ColorsPalette() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="type-h1">Палитра цветовых токенов</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Токены из <code className="mono text-[length:var(--text-sm)]">styles/tokens.css</code>. Бейдж — лучший
          контраст текста на заливке (WCAG).
        </p>
      </header>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h2 className="type-h3">Брендовый градиент</h2>
        <p className="type-body mt-1 text-[var(--muted)]">
          <code className="mono text-[length:var(--text-xs)]">--brand-grad</code> — только акцентные плитки, не фон
          приложения.
        </p>
        <div
          className="mt-3 flex h-20 items-end rounded-[var(--radius-md)] p-3 text-[length:var(--text-sm)] font-medium text-[var(--panel)]"
          style={{ background: "var(--brand-grad)" }}
        >
          KISS PM · decision surface
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {swatches.map((s) => (
          <div
            key={s.var}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-3"
          >
            <div
              className={`size-10 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] ${s.swatchClass}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[length:var(--text-sm)] font-medium text-[var(--text)]">{s.label}</div>
              <div className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{s.var}</div>
              <div className="mt-1">
                <ContrastChip hex={s.hex} />
              </div>
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
  name: "Палитра",
  render: () => <ColorsPalette />
};
