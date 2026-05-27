import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/domain/card-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { TaskDetailDrawer } from "@/views/blocks/task-detail-drawer";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Формы",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

function DrawerFormDemo() {
  const [open, setOpen] = useState(true);

  return (
    <PatternFrame title="Форма в боковой панели" hint="Быстрая карточка задачи без смены маршрута.">
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Открыть задачу
      </Button>
      <TaskDetailDrawer
        open={open}
        onOpenChange={setOpen}
        task={{
          id: "MDS-39",
          title: "Согласовать ТЗ",
          stage: { label: "В работе", tone: "info" },
          project: "Внедрение CRM"
        }}
      />
    </PatternFrame>
  );
}

export const Single: Story = {
  name: "Одна форма",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop1440" },
    docs: patternDocs("Компактная форма карточки задачи — как в боковой панели сущности.")
  },
  render: () => (
    <div className="app-canvas app-content pattern-story pattern-story--product-form">
      <CardPanel
        title="Параметры задачи"
        subtitle="MDS-39 · Внедрение CRM · черновик"
      >
        <form className="form-grid form-grid--single" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <Label htmlFor="pattern-title" className="field__label field__label--required">
              Название
            </Label>
            <Input id="pattern-title" defaultValue="Согласование ТЗ" placeholder="Например, согласование ТЗ" />
            <p className="field__hint">До 120 символов · видно исполнителю в канбане</p>
          </div>
          <div className="field">
            <Label htmlFor="pattern-owner" className="field__label">
              Исполнитель
            </Label>
            <Input id="pattern-owner" defaultValue="Иванов И." readOnly />
          </div>
          <div className="field">
            <Label htmlFor="pattern-desc" className="field__label">
              Описание
            </Label>
            <Textarea
              id="pattern-desc"
              defaultValue="Уточнить объём работ и согласовать сроки с заказчиком до пятницы."
              rows={3}
            />
          </div>
          <div className="form-actions">
            <Button type="button" variant="ghost">
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              Сохранить
            </Button>
          </div>
        </form>
      </CardPanel>
    </div>
  )
};

export const Wizard: Story = {
  name: "Мастер",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop1440" },
    docs: patternDocs("Трёхшаговый TaskCreateModalBlock для создания задачи.")
  },
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={1} initialProjectId="PRJ-2026-014" />
    </WorkspaceChrome>
  )
};

export const Inline: Story = {
  name: "Инлайн-редактирование",
  parameters: { docs: patternDocs("Поля в карточке сущности без отдельной страницы.") },
  render: () => (
    <PatternFrame title="Инлайн в карточке">
      <EntityDetailBlock
        title="Согласовать ТЗ"
        subtitle="MDS-39 · Внедрение CRM"
        stage={{ label: "В работе", tone: "info" }}
        variant="task"
      />
    </PatternFrame>
  )
};

export const Drawer: Story = {
  name: "Форма в боковой панели",
  parameters: {
    docs: patternDocs("Боковая панель xl + EntityDetailBlock: редактирование задачи в рабочем контексте.")
  },
  render: () => <DrawerFormDemo />
};
