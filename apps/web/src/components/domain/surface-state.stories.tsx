import type { Meta, StoryObj } from "@storybook/react";

import { SurfaceState } from "./surface-state";

/**
 * SurfaceState — единый переключатель состояний поверхности поверх примитивов
 * loading/error/forbidden/empty. Заменяет инлайн-дубли loading/error в поверхностях
 * delivery/crm/comms: единый скелетон, role="alert" в ошибке, человекочитаемые коды
 * (errorFormat) и компактный fallback для узких экранов (narrow).
 */
const meta: Meta<typeof SurfaceState> = {
  title: "UI/SurfaceState",
  component: SurfaceState,
  parameters: { layout: "padded" },
  tags: ["!autodocs"]
};
export default meta;
type Story = StoryObj<typeof SurfaceState>;

const ru: Record<string, string> = { request_failed: "Запрос не выполнен — попробуйте позже" };
const fmt = (code?: string) => (code && ru[code]) || code || "Неизвестная ошибка";

export const Loading: Story = {
  name: "Загрузка",
  render: () => (
    <SurfaceState status="loading" loadingLabel="Загрузка данных…">
      <div />
    </SurfaceState>
  )
};

export const ErrorWithRetry: Story = {
  name: "Ошибка (+ повтор)",
  render: () => (
    <SurfaceState status="error" error="request_failed" errorFormat={fmt} onRetry={() => {}}>
      <div />
    </SurfaceState>
  )
};

export const Forbidden: Story = {
  name: "Нет доступа",
  render: () => (
    <SurfaceState status="forbidden" forbidden={{ description: "Раздел доступен владельцу и администратору." }}>
      <div />
    </SurfaceState>
  )
};

export const Empty: Story = {
  name: "Пусто",
  render: () => (
    <SurfaceState status="empty" empty={{ title: "Нет записей", description: "Создайте первую запись, чтобы начать." }}>
      <div />
    </SurfaceState>
  )
};

export const Narrow: Story = {
  name: "Узкий экран (narrow)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <SurfaceState status="error" error="request_failed" errorFormat={fmt} onRetry={() => {}} narrow>
        <div />
      </SurfaceState>
    </div>
  )
};

export const Ready: Story = {
  name: "Готово (контент)",
  render: () => (
    <SurfaceState status="ready">
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--text)]">
        Контент поверхности отрендерен (status = ready).
      </div>
    </SurfaceState>
  )
};
