import type { Meta, StoryObj } from "@storybook/react";

import { PageIntro } from "./page-intro";

const meta: Meta<typeof PageIntro> = {
  title: "UI/PageIntro",
  component: PageIntro,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof PageIntro>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
