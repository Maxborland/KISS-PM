import type { Meta, StoryObj } from "@storybook/react";

const swatches = [
  {
    label: "Акцент",
    var: "--accent",
    swatchClass: "bg-[var(--accent)]"
  },
  {
    label: "Акцент при наведении",
    var: "--accent-hover",
    swatchClass: "bg-[var(--accent-hover)]"
  },
  {
    label: "Акцент (мягкий фон)",
    var: "--accent-soft",
    swatchClass: "bg-[var(--accent-soft)]"
  },
  {
    label: "Основной текст",
    var: "--text",
    swatchClass: "bg-[var(--text)]"
  },
  {
    label: "Усиленный текст",
    var: "--text-strong",
    swatchClass: "bg-[var(--text-strong)]"
  },
  {
    label: "Приглушённый текст",
    var: "--muted",
    swatchClass: "bg-[var(--muted)]"
  },
  {
    label: "Приглушённый текст (усил.)",
    var: "--muted-strong",
    swatchClass: "bg-[var(--muted-strong)]"
  },
  {
    label: "Панель",
    var: "--panel",
    swatchClass: "bg-[var(--panel)]"
  },
  {
    label: "Панель (усил.)",
    var: "--panel-strong",
    swatchClass: "bg-[var(--panel-strong)]"
  },
  {
    label: "Панель (приподнятая)",
    var: "--panel-elevated",
    swatchClass: "bg-[var(--panel-elevated)]"
  },
  {
    label: "Граница",
    var: "--border",
    swatchClass: "bg-[var(--border)]"
  },
  {
    label: "Граница (усил.)",
    var: "--border-strong",
    swatchClass: "bg-[var(--border-strong)]"
  },
  {
    label: "Успех",
    var: "--success",
    swatchClass: "bg-[var(--success)]"
  },
  {
    label: "Успех (мягкий фон)",
    var: "--success-soft",
    swatchClass: "bg-[var(--success-soft)]"
  },
  {
    label: "Предупреждение",
    var: "--warning",
    swatchClass: "bg-[var(--warning)]"
  },
  {
    label: "Предупреждение (мягкий фон)",
    var: "--warning-soft",
    swatchClass: "bg-[var(--warning-soft)]"
  },
  {
    label: "Опасность",
    var: "--danger",
    swatchClass: "bg-[var(--danger)]"
  },
  {
    label: "Опасность (мягкий фон)",
    var: "--danger-soft",
    swatchClass: "bg-[var(--danger-soft)]"
  },
  {
    label: "Информация",
    var: "--info",
    swatchClass: "bg-[var(--info)]"
  },
  {
    label: "Информация (мягкий фон)",
    var: "--info-soft",
    swatchClass: "bg-[var(--info-soft)]"
  },
  {
    label: "Фиолетовый",
    var: "--violet",
    swatchClass: "bg-[var(--violet)]"
  },
  {
    label: "Фиолетовый (мягкий фон)",
    var: "--violet-soft",
    swatchClass: "bg-[var(--violet-soft)]"
  }
] as const;

function ColorsPalette() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="type-h1">Палитра цветовых токенов</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Токены из <code className="mono text-[length:var(--text-sm)]">styles/tokens.css</code> — согласование
          перед экранами Phase 2.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {swatches.map((s) => (
          <div
            key={s.var}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-3"
          >
            <div
              className={`size-10 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] ${s.swatchClass}`}
            />
            <div>
              <div className="text-[length:var(--text-sm)] font-medium text-[var(--text)]">{s.label}</div>
              <div className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{s.var}</div>
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
