import type { Meta, StoryObj } from "@storybook/react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from "@/components/ui/command";
import { PatternFrame, patternDocs, PATTERN_STORY_PARAMETERS } from "@/stories/patterns/pattern-story-helpers";

const meta: Meta = {
  title: "Patterns/Поиск и команды",
  parameters: PATTERN_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const CommandPalette: Story = {
  name: "Командная палитра",
  parameters: { docs: patternDocs("cmdk + Dialog — глобальный поиск действий и сущностей.") },
  render: () => (
    <PatternFrame title="Командная палитра" hint="RU labels; shortcuts — опционально.">
      <CommandDialog open onOpenChange={() => undefined}>
        <Command>
          <CommandInput placeholder="Поиск проектов, задач, команд…" />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup heading="Навигация">
              <CommandItem>
                Моя работа
                <CommandShortcut>⌘1</CommandShortcut>
              </CommandItem>
              <CommandItem>
                Список проектов
                <CommandShortcut>⌘2</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Действия">
              <CommandItem>Создать задачу</CommandItem>
              <CommandItem>Открыть аудит проекта</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </PatternFrame>
  )
};

export const InlineSearch: Story = {
  name: "Встроенный Command",
  parameters: { docs: patternDocs("Компактный список команд без модального слоя.") },
  render: () => (
    <PatternFrame title="Встроенный поиск">
      <Command className="pattern-story__command-panel">
        <CommandInput placeholder="Фильтр справочника…" />
        <CommandList>
          <CommandGroup heading="Клиенты">
            <CommandItem>СеверСтрой</CommandItem>
            <CommandItem>ТехноПром</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PatternFrame>
  )
};
