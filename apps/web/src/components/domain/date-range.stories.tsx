import type { Meta, StoryObj } from "@storybook/react";

import { DateRange } from "./date-range";

const meta: Meta<typeof DateRange> = {
  title: "Composites/DateRange",
  component: DateRange,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DateRange>;

export const Display: Story = {
  name: "Только текст",
  render: () => (
    <DateRange mode="display" start="2026-05-01" finish="2026-05-26" />
  )
};

export const Edit: Story = {
  name: "С DatePicker",
  render: () => <DateRange mode="edit" />
};
