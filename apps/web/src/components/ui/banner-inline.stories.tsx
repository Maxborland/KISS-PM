import type { Meta, StoryObj } from "@storybook/react";

import { BannerInline } from "./banner-inline";

const meta: Meta<typeof BannerInline> = {
  title: "UI/BannerInline",
  component: BannerInline,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof BannerInline>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
