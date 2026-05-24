import type { Meta, StoryObj } from "@storybook/react";

import { SearchPill } from "./search-pill";

const meta: Meta<typeof SearchPill> = {
  title: "UI/SearchPill",
  component: SearchPill,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof SearchPill>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
