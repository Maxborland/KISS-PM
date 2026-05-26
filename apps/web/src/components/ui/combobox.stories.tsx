import type { Meta, StoryObj } from "@storybook/react";

import { Combobox } from "./combobox";
import { ComboboxShowcase } from "@/stories/showcases/demos";

import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta = {
  title: "Primitives/Combobox",
  component: Combobox,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof Combobox>;

/** Витрина design-v3 (React + CVA, токены) */
export const DesignV2: Story = {
  name: "Витрина",
  parameters: { layout: "fullscreen" },
  render: () => <ComboboxShowcase />
};

export const Variants: Story = createVariantsStory("combobox");
