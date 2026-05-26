import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
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

export const Single: Story = {
  name: "Одна форма",
  parameters: { docs: patternDocs("Простая форма с label + validation message.") },
  render: () => (
    <PatternFrame title="Форма · один экран">
      <form className="form-grid form-grid--1" onSubmit={(e) => e.preventDefault()}>
        <div className="form-field">
          <Label htmlFor="pattern-title">Название</Label>
          <Input id="pattern-title" placeholder="Например, согласование ТЗ" />
        </div>
        <div className="form-field">
          <Label htmlFor="pattern-desc">Описание</Label>
          <Textarea id="pattern-desc" placeholder="Контекст для исполнителя" rows={3} />
        </div>
        <div className="form-actions">
          <Button type="submit" variant="primary">
            Сохранить
          </Button>
          <Button type="button" variant="ghost">
            Отмена
          </Button>
        </div>
      </form>
    </PatternFrame>
  )
};

export const Wizard: Story = {
  name: "Мастер (wizard)",
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop1440" },
    docs: patternDocs("Трёхшаговый TaskCreateModalBlock — product wizard.")
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
  name: "Форма в drawer",
  parameters: {
    docs: patternDocs("Sheet xl — см. Patterns/Drawer детали · Карточка задачи в Sheet.")
  },
  render: () => (
    <PatternFrame title="Форма в drawer" hint="Контент формы внутри Sheet — отдельная story в разделе Drawer.">
      <p className="type-body u-text-muted">
        Эталон: <strong>Patterns → Drawer детали → Карточка задачи в Sheet</strong>.
      </p>
    </PatternFrame>
  )
};
