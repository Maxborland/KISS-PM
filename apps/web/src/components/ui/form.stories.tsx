import type { Meta, StoryObj } from "@storybook/react";

import { CatalogCrossRefParagraph } from "@/stories/story-docs-copy";

import { Form } from "./form";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof Form> = {
  title: "Primitives/Form",
  component: Form,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Docs: Story = {
  render: () => <CatalogCrossRefParagraph />
};

export const Variants: Story = createVariantsStory("form");
