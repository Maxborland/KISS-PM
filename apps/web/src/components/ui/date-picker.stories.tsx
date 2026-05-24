import type { Meta, StoryObj } from "@storybook/react";

import { DatePicker } from "./date-picker";
import { DatePickerShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof DatePicker> = {
  title: "UI/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  name: "По умолчанию",
  args: {
    placeholder: "Выберите дату"
  }
};

/** Витрина design-v3 (popover + календарь) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <DatePickerShowcase />
};

export const Variants: Story = createVariantsStory("date-picker");
