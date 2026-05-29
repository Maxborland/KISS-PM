import type { StoryObj } from "@storybook/react";

import { UI_VARIANT_ITEMS, type UiVariantKey } from "@/stories/ui-variant-presets";
import { VariantMatrix } from "@/stories/variant-matrix";

/** Одна story «Варианты» на компонент — RU-подписи, без смены id `DesignV2` / `Docs`. */
export function createVariantsStory(key: UiVariantKey): StoryObj<Record<string, never>> {
  const items = UI_VARIANT_ITEMS[key];
  return {
    name: "Состояния",
    parameters: {
      layout: "centered",
      docs: {
        description: {
          story: "Матрица основных продуктовых состояний компонента: базовое использование, тоны, disabled/empty/error-варианты там, где они есть в API компонента."
        }
      }
    },
    render: () => <VariantMatrix items={items} />
  };
}
