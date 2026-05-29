import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj;

const Row = ({
  label,
  className,
  sample
}: {
  label: string;
  className: string;
  sample: string;
}) => (
  <div className="flex items-baseline gap-6 border-b border-[var(--border-subtle)] py-3">
    <div className="w-[160px] shrink-0 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
      {label}
    </div>
    <p className={className}>{sample}</p>
  </div>
);

/** Шкала: body 14 · h3 18 · h2 24 · h1 32 */
export const TypeScale: Story = {
  name: "Шкала типографики",
  render: () => (
    <div className="space-y-6">
      <header>
        <h1 className="type-h1">Шкала типографики</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Рантайм-классы из контракта design-v3 — один h1 32px на экран, body 14px по умолчанию.
        </p>
      </header>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-6">
        <Row label="h1 · 32 px" className="type-h1" sample="Администрирование рабочей области" />
        <Row label="h2 · 24 px" className="type-h2" sample="Командная палитра" />
        <Row label="h3 · 18 px" className="type-h3" sample="Не удалось загрузить данные" />
        <Row
          label="Основной текст · 14 px"
          className="type-body"
          sample="Сервер вернул 503. Подождите 30 секунд и повторите."
        />
        <Row
          label="Подпись · 12 px"
          className="u-text-sm u-text-muted"
          sample="Подпись, мета, заголовок группы"
        />
        <Row label="Микро · 11 px" className="u-text-xs u-text-muted" sample="Хелпер, счётчики, kbd" />
      </div>
    </div>
  )
};

export const FontPair: Story = {
  name: "Семейства шрифтов",
  render: () => (
    <div className="space-y-6">
      <header>
        <h1 className="type-h1">Семейства шрифтов</h1>
        <p className="type-body mt-2 text-[var(--muted)]">
          Inter (UI) · Inter Tight (display) · JetBrains Mono (код и числа).
        </p>
      </header>
      <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--panel)] p-6">
        <p
          className="text-[length:var(--text-display)] font-semibold leading-[var(--lh-display)] text-[var(--text-strong)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Inter Tight · KISS PM
        </p>
        <p className="type-body max-w-[640px] text-[var(--muted-strong)]" style={{ fontFamily: "var(--font-ui)" }}>
          Inter — основной текст интерфейса 14px. Inter Tight — заголовки и display (`--text-display` 40px).
          Plus Jakarta Sans остаётся fallback в `--font-display`.
        </p>
        <p className="mono text-[length:var(--text-md)] text-[var(--muted-strong)]">PRJ-2026-014 · 27.05.2026</p>
        <p
          className="text-[length:var(--text-eyebrow)] font-semibold uppercase tracking-[var(--letter-eyebrow)] text-[var(--muted-strong)]"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          Eyebrow · --text-eyebrow
        </p>
      </div>
    </div>
  )
};
