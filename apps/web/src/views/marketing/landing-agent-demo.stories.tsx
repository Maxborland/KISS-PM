import type { Meta, StoryObj } from "@storybook/react";

import { LandingAgentDemo } from "@/widgets/landing-agent-demo";

const meta: Meta<typeof LandingAgentDemo> = {
  title: "Composites/Marketing/LandingAgentDemo",
  component: LandingAgentDemo,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof LandingAgentDemo>;

export const Initial: Story = { name: "Initial", args: { preset: "initial" } };
export const MessageDrafted: Story = { name: "MessageDrafted", args: { preset: "message-drafted" } };
export const AgentThinking: Story = { name: "AgentThinking", args: { preset: "agent-thinking" } };
export const ActivitySteps: Story = { name: "ActivitySteps", args: { preset: "activity-steps" } };
export const ReviewPanelOpening: Story = {
  name: "ReviewPanelOpening",
  args: { preset: "review-panel-opening" }
};
export const ReviewPanelOpen: Story = { name: "ReviewPanelOpen", args: { preset: "review-panel-open" } };
export const ChangeSelected: Story = { name: "ChangeSelected", args: { preset: "change-selected" } };
export const ChangeEditingDate: Story = {
  name: "ChangeEditingDate",
  args: { preset: "change-editing-date" }
};
export const ChangeRejected: Story = { name: "ChangeRejected", args: { preset: "change-rejected" } };
export const PermissionRequired: Story = {
  name: "PermissionRequired",
  args: { preset: "permission-required" }
};
export const ChangesApplied: Story = { name: "ChangesApplied", args: { preset: "changes-applied" } };
export const AgentDropdownOpen: Story = {
  name: "AgentDropdownOpen",
  args: { preset: "agent-dropdown-open" }
};
export const AppNavCollapsed: Story = { name: "AppNavCollapsed", args: { preset: "app-nav-collapsed" } };
export const AppNavExpanded: Story = { name: "AppNavExpanded", args: { preset: "app-nav-expanded" } };
export const MobileLeftDrawer: Story = {
  name: "MobileLeftDrawer",
  args: { preset: "mobile-left-drawer", mobile: true }
};
export const MobileReviewDrawer: Story = {
  name: "MobileReviewDrawer",
  args: { preset: "mobile-review-drawer", mobile: true }
};
export const SecondPromptThinking: Story = {
  name: "SecondPromptThinking",
  args: { preset: "second-prompt-thinking" }
};
export const ResetDemo: Story = { name: "ResetDemo", args: { preset: "reset-demo" } };
