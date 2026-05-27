import type { Meta, StoryObj } from "@storybook/react";

import { DataTable } from "@/components/domain/data-table";
import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Массовые действия",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const SelectionBar: Story = {
  name: "Панель выбора (пока недоступно)",
  parameters: {
    docs: patternDocs(
      "Массовый выбор появится вместе с управляемой командой; до этого действия недоступны и объясняют причину."
    )
  },
  render: () => (
    <PatternFrame title="Массовые действия" hint="Кнопки недоступны до подключения командного слоя и аудита.">
      <BannerInline variant="info">
        Выбрано 2 задачи. Массовое назначение и смена статуса появятся после подключения управляемого действия и аудита.
      </BannerInline>
      <div className="pattern-story__bulk-bar">
        <Button variant="secondary" size="sm" disabled title="Демо Storybook: массовое назначение в backlog">
          Назначить исполнителя
        </Button>
        <Button variant="ghost" size="sm" disabled title="Демо Storybook: массовая смена статуса в backlog">
          Сменить статус
        </Button>
      </div>
      <DataTable>
        <thead>
          <tr>
            <th>
              <Checkbox disabled aria-label="Выбрать все" title="Демо Storybook: bulk selection в backlog" />
            </th>
            <th>Код</th>
            <th>Название</th>
            <th>Исполнитель</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Checkbox disabled aria-label="Выбрать MDS-39" title="Демо Storybook: bulk selection в backlog" />
            </td>
            <td className="mono">MDS-39</td>
            <td>Согласовать ТЗ</td>
            <td>Иванова М.</td>
          </tr>
          <tr>
            <td>
              <Checkbox disabled aria-label="Выбрать MDS-40" title="Демо Storybook: bulk selection в backlog" />
            </td>
            <td className="mono">MDS-40</td>
            <td>Настроить интеграцию</td>
            <td>Петров А.</td>
          </tr>
        </tbody>
      </DataTable>
    </PatternFrame>
  )
};
