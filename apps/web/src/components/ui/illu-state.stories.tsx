import type { Meta, StoryObj } from "@storybook/react";

import { IlluState } from "./illu-state";

const meta: Meta<typeof IlluState> = {
  title: "UI/IlluState",
  component: IlluState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof IlluState>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
