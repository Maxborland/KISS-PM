import type { Meta, StoryObj } from "@storybook/react";
import { Calendar } from "lucide-react";

import { IconPill } from "./icon-pill";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof IconPill> = {
  title: "UI/IconPill",
  component: IconPill,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof IconPill>;

export const Default: Story = {
  name: "Календарь",
  render: () => <IconPill icon={Calendar} label="Календарь" />
};

export const Variants: Story = createVariantsStory("icon-pill");
