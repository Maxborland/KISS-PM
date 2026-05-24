import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { Command } from "./command";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof Command> = {
  title: "UI/Command",
  component: Command,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Command>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("command");
