import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "accent", "secondary", "outline", "ghost", "destructive", "link"]
    },
    size: { control: "select", options: ["default", "sm", "md", "lg", "icon", "xs"] }
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: "Сохранить", variant: "default" }
};

export const Secondary: Story = {
  args: { children: "Отмена", variant: "secondary" }
};

export const Outline: Story = {
  args: { children: "Ещё", variant: "outline" }
};

export const Ghost: Story = {
  args: { children: "Скрыть", variant: "ghost" }
};

export const Destructive: Story = {
  args: { children: "Удалить", variant: "destructive" }
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button size="sm">SM</Button>
      <Button size="lg">LG</Button>
    </div>
  )
};
