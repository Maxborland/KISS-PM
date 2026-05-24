import type { Meta, StoryObj } from "@storybook/react";

import { Segmented } from "./segmented";

const meta: Meta<typeof Segmented> = {
  title: "UI/Segmented",
  component: Segmented,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Segmented>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
