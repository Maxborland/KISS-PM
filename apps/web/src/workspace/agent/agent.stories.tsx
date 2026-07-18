import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";

import { AgentSurface } from "@/workspace/agent/agent-surface";
import { setMockAgentScenario, type MockAgentFetchOptions } from "@/workspace/agent/mock-agent-backend";

/**
 * Агент — чат с ассистентом на боевом контракте propose/execute: сообщение →
 * POST /agent/propose (LLM-цикл, ничего не меняется) → сверка изменений →
 * подтверждение → POST /agent/execute (governed-команды + audit). В Storybook —
 * contract-mock (createMockAgentFetch): детерминированный «мозг», реальный клиент.
 * Оболочку WorkspaceShell даёт route; здесь поверхность standalone. Состояния
 * (сверка, квитанция, деградация провайдера) доводятся play-функциями через
 * реальный UI-поток — предзаполнить их пропсами нельзя (поверхность без пропсов).
 */
const meta: Meta<typeof AgentSurface> = {
  title: "Workspace/Agent",
  component: AgentSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AgentSurface>;

// Вариант contract-mock задаётся ДО монтирования поверхности: useAgent создаёт
// mock-fetch без аргументов (боевой код о вариантах витрины не знает), поэтому
// story выставляет модульный сценарий mock-agent-backend. Каждая story задаёт
// свой (Default — null): переключение историй не наследует чужой вариант.
const withAgentScenario = (options: MockAgentFetchOptions | null): Decorator =>
  function AgentScenario(Story) {
    setMockAgentScenario(options);
    return <Story />;
  };

// Отправка цели через реальный composer (лейблы — контракт e2e agent-partial-apply).
async function submitGoal(canvasElement: HTMLElement, goal: string) {
  const canvas = within(canvasElement);
  const input = await canvas.findByLabelText("Сообщение Генри Гантту");
  await userEvent.type(input, goal);
  await userEvent.click(canvas.getByRole("button", { name: "Отправить" }));
  return canvas;
}

export const Default: Story = {
  name: "Агент",
  tags: ["!autodocs"],
  decorators: [withAgentScenario(null)]
};

/** Панель сверки с многокарточным предложением: три безопасных forward-перехода,
    каждый — карточка с превью «до → после», выбором и отклонением. */
export const ReviewOpen: Story = {
  name: "Сверка открыта",
  tags: ["!autodocs"],
  decorators: [withAgentScenario({ proposeAllForward: true })],
  play: async ({ canvasElement }) => {
    const canvas = await submitGoal(canvasElement, "Продвинь мои задачи по порталу");
    await waitFor(() => expect(canvas.getAllByTestId("agent-change-card")).toHaveLength(3), { timeout: 5000 });
  }
};

/** Result-сообщение с квитанцией применения (P0): планово-коммитная строка
    (planningAuditEventId + ссылка «Открыть в Коммитах»), agent-action аудит-запись
    и корреляция батча. Ссылки в журнал аудита нет честно: в Storybook сессии нет →
    права tenant.audit_events.read нет. */
export const ResultWithReceipt: Story = {
  name: "Результат с квитанцией",
  tags: ["!autodocs"],
  decorators: [withAgentScenario({ executeReceipt: true })],
  play: async ({ canvasElement }) => {
    const canvas = await submitGoal(canvasElement, "Продвинь задачу и разреши перегрузку дизайнера");
    const apply = await canvas.findByRole("button", { name: "Применить выбранное" }, { timeout: 5000 });
    await userEvent.click(apply);
    const receipt = await canvas.findByTestId("agent-receipt", undefined, { timeout: 5000 });
    await expect(receipt).toHaveTextContent("audit-demo-9");
    await expect(receipt).toHaveTextContent("agent-action-demo-1");
    await expect(receipt).toHaveTextContent("agent-execute-demo");
  }
};

/** Инсталляция без LLM-ключа (G7-01): баннер «Демо-режим» из provider.live=false,
    а отправка получает серверный 503 agent_provider_not_configured — реплика
    квитируется в треде (в live сервер её ещё и персистит; мок эфемерен честно). */
export const ProviderNotConfigured: Story = {
  name: "LLM не настроен",
  tags: ["!autodocs"],
  decorators: [
    withAgentScenario({
      provider: { model: "mock-llm", live: false, configured: false },
      providerNotConfigured: true
    })
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Баннер деградации виден ещё до отправки — по provider из GET /agent/tools.
    await canvas.findByText("Демо-режим");
    await submitGoal(canvasElement, "Проверь проект");
    await waitFor(() => expect(canvas.getByText(/LLM-провайдер не настроен/)).toBeVisible(), { timeout: 5000 });
  }
};
