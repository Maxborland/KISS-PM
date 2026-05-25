import type { Meta, StoryObj } from "@storybook/react";

import { TrendArrow } from "@/components/ui/trend-arrow";
import { KpiTile } from "./kpi-tile";

const meta: Meta<typeof KpiTile> = {
  title: "Composites/KpiTile",
  component: KpiTile,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof KpiTile>;

export const Default: Story = {
  name: "По умолчанию",
  render: () => (
    <KpiTile
      label="Маржа"
      value="38%"
      meta={<TrendArrow direction="up" value="+2 п.п." />}
    />
  )
};
