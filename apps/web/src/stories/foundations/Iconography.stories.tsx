import type { Meta, StoryObj } from "@storybook/react";
import { Calendar, Filter, Plus, Settings, User } from "lucide-react";

const meta: Meta = {
  title: "Foundations/Iconography",
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj;

const ICONS = [
  { Icon: Settings, name: "Настройки" },
  { Icon: User, name: "Пользователь" },
  { Icon: Filter, name: "Фильтр" },
  { Icon: Plus, name: "Создать" },
  { Icon: Calendar, name: "Календарь" }
] as const;

const SIZES = [
  { px: 14, label: "14 px · inline / chip" },
  { px: 16, label: "16 px · кнопка / toolbar" },
  { px: 20, label: "20 px · page action" }
] as const;

const STROKE = 1.75;

function IconographyShowcase() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="type-h1">Иконография Lucide</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Единый stroke <code className="mono text-[length:var(--text-xs)]">{STROKE}</code>, размеры 14 / 16 / 20.
          Импорт только <code className="mono text-[length:var(--text-xs)]">lucide-react@^0.460</code>.
        </p>
      </header>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)]">
        <table className="w-full text-[length:var(--text-sm)]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[length:var(--text-xs)] text-[var(--muted-strong)]">
              <th className="p-3 font-medium">Иконка</th>
              {SIZES.map((s) => (
                <th key={s.px} className="p-3 font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ICONS.map(({ Icon, name }) => (
              <tr key={name} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="p-3 text-[var(--text)]">{name}</td>
                {SIZES.map((s) => (
                  <td key={s.px} className="p-3">
                    <Icon size={s.px} strokeWidth={STROKE} className="text-[var(--text)]" aria-hidden />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[length:var(--text-xs)] text-[var(--muted)]">Icon pill (демо):</span>
        <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--muted-strong)]">
          <Settings size={16} strokeWidth={STROKE} aria-hidden />
        </span>
      </div>
    </div>
  );
}

export const LucideScale: Story = {
  name: "Размеры и stroke",
  render: () => <IconographyShowcase />
};
