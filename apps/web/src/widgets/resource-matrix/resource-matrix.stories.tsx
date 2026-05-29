import type { Meta, StoryObj } from "@storybook/react";

import { getResourceMatrixMock } from "./mock-data";
import { ResourceMatrix } from "./resource-matrix";

const meta: Meta<typeof ResourceMatrix> = {
  title: "Widgets/ResourceMatrix",
  component: ResourceMatrix,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop1440" },
    docs: {
      description: {
        component:
          "Матрица ресурсов для проверки доступности ролей: нормальная загрузка, пустой период и перегруз по людям/часам."
      }
    }
  },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ResourceMatrix>;

export const Default: Story = {
  name: "Обзор",
  render: () => <ResourceMatrix data={getResourceMatrixMock("default")} />
};

export const Empty: Story = {
  name: "Матрица · пусто",
  parameters: {
    scenario: "empty",
    docs: {
      description: {
        story: "Пустой период без назначений; используется для экранов ресурсов и конфликтов загрузки."
      }
    }
  },
  render: () => <ResourceMatrix data={getResourceMatrixMock("empty")} />
};

export const Overload: Story = {
  name: "Матрица · перегруз",
  parameters: {
    scenario: "overload",
    docs: {
      description: {
        story: "Перегруз показывает, где нужно переназначение, сдвиг срока или управленческая эскалация."
      }
    }
  },
  render: () => <ResourceMatrix data={getResourceMatrixMock("overload")} />
};
