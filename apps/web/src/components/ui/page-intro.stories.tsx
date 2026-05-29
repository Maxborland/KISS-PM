import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { PageIntro } from "./page-intro";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof PageIntro> = {
  title: "Primitives/PageIntro",
  component: PageIntro,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof PageIntro>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("page-intro");
