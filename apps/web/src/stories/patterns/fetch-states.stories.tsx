import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ForbiddenState } from "@/components/ui/forbidden-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Состояния загрузки",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Empty: Story = {
  name: "Пусто",
  parameters: { docs: patternDocs("L3 empty-state для списков и панелей без данных.") },
  render: () => (
    <PatternFrame title="Пустое состояние" hint="Уровни L1–L4 — см. components/ui/empty-state.">
      <EmptyState
        level="L3"
        title="По этому фильтру задач нет"
        description="Сохранённый вид активен, но сейчас не находит задач. Сбросьте фильтры или создайте задачу вручную."
        action={
          <>
            <Button variant="primary" onClick={() => undefined}>
              Создать задачу
            </Button>
            <Button variant="secondary" onClick={() => undefined}>
              Сбросить фильтры
            </Button>
          </>
        }
      />
    </PatternFrame>
  )
};

export const Loading: Story = {
  name: "Загрузка",
  parameters: { docs: patternDocs("Skeleton / spinner до ответа MSW (сценарий «Загрузка»).") },
  render: () => (
    <PatternFrame title="Загрузка" hint="ScreenBlockGate и LoadingState — единый RU copy.">
      <LoadingState label="Загрузка данных…" />
    </PatternFrame>
  )
};

export const Error: Story = {
  name: "Ошибка",
  parameters: { docs: patternDocs("Error-state с correlation id и действием «Повторить».") },
  render: () => (
    <PatternFrame title="Ошибка">
      <ErrorState
        level="L3"
        errorKey="500"
        correlationId="kiss-demo-7f3a2c91"
        description="Не удалось обновить список задач. Данные на экране могли устареть; повторите запрос или передайте код обращения поддержке."
        onRetry={() => undefined}
        onSupport={() => undefined}
      />
    </PatternFrame>
  )
};

export const Forbidden: Story = {
  name: "Нет доступа",
  parameters: { docs: patternDocs("403 / RBAC — без технических деталей API в copy.") },
  render: () => (
    <PatternFrame title="Нет доступа">
      <ForbiddenState
        level="L3"
        title="Недостаточно прав"
        description="Ваша роль не открывает этот раздел. Запросите доступ у администратора рабочей области."
        action={
          <Button variant="secondary" onClick={() => undefined}>
            Запросить доступ
          </Button>
        }
      />
    </PatternFrame>
  )
};
