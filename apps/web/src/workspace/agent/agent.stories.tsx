import type { Meta, StoryObj } from "@storybook/react";

import { AgentSurface } from "@/workspace/agent/agent-surface";

/**
 * Агент — чат с ассистентом на боевом контракте propose/execute: сообщение →
 * POST /agent/propose (LLM-цикл, ничего не меняется) → сверка изменений →
 * подтверждение → POST /agent/execute (governed-команды + audit). В Storybook —
 * contract-mock (createMockAgentFetch): детерминированный «мозг», реальный клиент.
 * Оболочку WorkspaceShell даёт route; здесь поверхность standalone.
 */
const meta: Meta<typeof AgentSurface> = {
  title: "Workspace/Agent",
  component: AgentSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AgentSurface>;

export const Default: Story = { name: "Агент" };
