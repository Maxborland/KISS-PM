import type { Meta, StoryObj } from "@storybook/react";

import { LoadingState } from "./loading-state";

const meta: Meta<typeof LoadingState> = {
  title: "UI/LoadingState",
  component: LoadingState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof LoadingState>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
