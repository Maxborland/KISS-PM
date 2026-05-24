import type { Meta, StoryObj } from "@storybook/react";

import { DropdownMenu } from "./dropdown-menu";

const meta: Meta<typeof DropdownMenu> = {
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
