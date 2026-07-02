import type { Meta, StoryObj } from "@storybook/react";
import { LandingAgentDemo } from "../components/landing-agent-demo/LandingAgentDemo";
import type { LandingAgentDemoPreset } from "../components/landing-agent-demo/types";

type StoryArgs = {
  preset: LandingAgentDemoPreset;
  mobile?: boolean;
};

const meta: Meta<StoryArgs> = {
  title: "Marketing/LandingAgentDemo",
  parameters: {
    layout: "fullscreen",
  },
  args: {
    preset: "initial",
    mobile: false,
  },
  render: ({ preset, mobile }) => <LandingAgentDemo preset={preset} mobile={mobile} />,
};

export default meta;

type Story = StoryObj<StoryArgs>;

export const Initial: Story = { args: { preset: "initial" } };
export const MessageDrafted: Story = { args: { preset: "message-drafted" } };
export const AgentThinking: Story = { args: { preset: "agent-thinking" } };
export const ActivitySteps: Story = { args: { preset: "activity-steps" } };
export const ReviewPanelOpening: Story = { args: { preset: "review-panel-opening" } };
export const ReviewPanelOpen: Story = { args: { preset: "review-panel-open" } };
export const ChangeSelected: Story = { args: { preset: "change-selected" } };
export const ChangeEditingDate: Story = { args: { preset: "change-editing-date" } };
export const ChangeEditingDecision: Story = { args: { preset: "change-editing-decision" } };
export const ChangeRejected: Story = { args: { preset: "change-rejected" } };
export const PermissionRequired: Story = { args: { preset: "permission-required" } };
export const StaleDataWarning: Story = { args: { preset: "stale-data-warning" } };
export const ChangesApplied: Story = { args: { preset: "changes-applied" } };
export const AgentDropdownOpen: Story = { args: { preset: "agent-dropdown-open" } };
export const AppNavCollapsed: Story = { args: { preset: "app-nav-collapsed" } };
export const AppNavExpanded: Story = { args: { preset: "app-nav-expanded" } };
export const MobileLeftDrawer: Story = {
  args: { preset: "mobile-left-drawer", mobile: true },
  parameters: { viewport: { defaultViewport: "mobile390" } },
};
export const MobileReviewDrawer: Story = {
  args: { preset: "mobile-review-drawer", mobile: true },
  parameters: { viewport: { defaultViewport: "mobile390" } },
};
export const SecondPromptThinking: Story = { args: { preset: "second-prompt-thinking" } };
export const ResetDemo: Story = { args: { preset: "reset-demo" } };
