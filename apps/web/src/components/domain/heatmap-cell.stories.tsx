import type { Meta, StoryObj } from "@storybook/react";

import { HeatmapCell } from "./heatmap-cell";

const meta: Meta<typeof HeatmapCell> = {
  title: "Composites/HeatmapCell",
  component: HeatmapCell,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof HeatmapCell>;

export const Scale: Story = {
  name: "Шкала 0–4",
  render: () => (
    <div className="ds-demo__row">
      <HeatmapCell value={0} level={0} />
      <HeatmapCell value={40} level={1} />
      <HeatmapCell value={75} level={2} />
      <HeatmapCell value={95} level={3} />
      <HeatmapCell value={120} level={4} />
    </div>
  )
};
