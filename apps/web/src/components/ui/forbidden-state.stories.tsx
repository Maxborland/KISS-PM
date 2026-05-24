import type { Meta, StoryObj } from "@storybook/react";

import { ForbiddenState } from "./forbidden-state";

const meta: Meta<typeof ForbiddenState> = {
  title: "UI/ForbiddenState",
  component: ForbiddenState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ForbiddenState>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
