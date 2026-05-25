import type { Meta, StoryObj } from "@storybook/react";

import { AvatarGroup } from "./avatar-group";
import { createVariantsStory } from "@/stories/createVariantsStory";

const meta: Meta<typeof AvatarGroup> = {
  title: "UI/AvatarGroup",
  component: AvatarGroup,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof AvatarGroup>;

export const Variants: Story = createVariantsStory("avatar-group");
