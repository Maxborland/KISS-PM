import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { IlluState } from "./illu-state";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof IlluState> = {
  title: "UI/IlluState",
  component: IlluState,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof IlluState>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("illu-state");
