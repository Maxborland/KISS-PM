"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchPill } from "@/components/ui/search-pill";
import { Segmented } from "@/components/ui/segmented";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Панель фильтров",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

function FiltersToolbarDemo() {
  const [scope, setScope] = useState<"active" | "archive" | "templates">("active");
  return (
    <PatternFrame title="Панель фильтров" hint="Эталон: projects-list, project-audit, deals.">
      <div className="view-toolbar">
        <SearchPill className="u-w-280" placeholder="Поиск по названию" />
        <Button variant="secondary" size="sm" disabled title="Демо Storybook: фильтр подключится к API">
          <Filter className="size-4" aria-hidden />
          Фильтр
        </Button>
        <Segmented
          name="pattern-project-scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: "active", label: "Активные" },
            { value: "archive", label: "Архив" },
            { value: "templates", label: "Шаблоны" }
          ]}
        />
      </div>
      <p className="u-text-sm u-text-muted">Выбран сегмент: {scope}</p>
    </PatternFrame>
  );
}

export const Toolbar: Story = {
  name: "Фильтры и сегменты",
  parameters: {
    docs: patternDocs(
      "view-toolbar: поиск, фильтр, сегмент набора данных. Disabled с title — демо без fake API."
    )
  },
  render: () => <FiltersToolbarDemo />
};
