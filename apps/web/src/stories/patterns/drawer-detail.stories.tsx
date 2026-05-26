import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TaskDetailDrawer } from "@/views/blocks/task-detail-drawer";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Drawer детали",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

function DrawerDetailDemo() {
  const [open, setOpen] = useState(true);
  return (
    <PatternFrame
      title="Drawer детали задачи"
      hint="Sheet xl + EntityDetailBlock; ссылка «Открыть как страницу»."
    >
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

export const TaskDetail: Story = {
  name: "Карточка задачи в Sheet",
  parameters: {
    docs: patternDocs(
      "Паттерн быстрого просмотра из дашборда / канбана без смены маршрута. Play: Views/Screens → 02 Моя работа · DnD."
    )
  },
  render: () => <DrawerDetailDemo />
};
