import type { Meta, StoryObj } from "@storybook/react";

import { CommandDialog } from "./command-dialog";

const meta: Meta<typeof CommandDialog> = {
  title: "UI/CommandDialog",
  component: CommandDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof CommandDialog>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
