import type { Meta, StoryObj } from "@storybook/react";

import { getResourceMatrixMock } from "./mock-data";
import { ResourceMatrix } from "./resource-matrix";

const meta: Meta<typeof ResourceMatrix> = {
  title: "Widgets/ResourceMatrix",
  component: ResourceMatrix,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop1440" }
  },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ResourceMatrix>;

export const Default: Story = {
  name: "Матрица · по умолчанию",
  render: () => <ResourceMatrix data={getResourceMatrixMock("default")} />
};

export const Empty: Story = {
  name: "Матрица · пусто",
  parameters: { scenario: "empty" },
  render: () => <ResourceMatrix data={getResourceMatrixMock("empty")} />
};

export const Overload: Story = {
  name: "Матрица · перегруз",
  parameters: { scenario: "overload" },
  render: () => <ResourceMatrix data={getResourceMatrixMock("overload")} />
};
