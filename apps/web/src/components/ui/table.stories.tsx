import type { Meta, StoryObj } from "@storybook/react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { TableShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Table>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <TableShowcase />
};

/** Принцип 1: числовые колонки право-выровнены + tabular-nums (разряды совпадают), длинный текст обрезается. */
export const Numeric: Story = {
  name: "Числа и обрезка",
  render: () => (
    <div className="w-[34rem]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Проект</TableHead>
            <TableHead numeric>Часы</TableHead>
            <TableHead numeric>Бюджет</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell truncate>Очень длинное название проекта, которое должно обрезаться многоточием</TableCell>
            <TableCell numeric>8</TableCell>
            <TableCell numeric>1 200 000</TableCell>
          </TableRow>
          <TableRow>
            <TableCell truncate>Короткий</TableCell>
            <TableCell numeric>128</TableCell>
            <TableCell numeric>90 000</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
};

export const Variants: Story = createVariantsStory("table");
