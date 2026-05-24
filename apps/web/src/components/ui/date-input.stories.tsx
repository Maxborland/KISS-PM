import type { Meta, StoryObj } from "@storybook/react";

import { DateInput } from "./date-input";

const meta: Meta<typeof DateInput> = {
  title: "UI/DateInput",
  component: DateInput,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DateInput>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
