import type { Meta, StoryObj } from "@storybook/react";

import { Table } from "./table";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Table>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
