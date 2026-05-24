import type { StoryObj } from "@storybook/react";

import { UI_VARIANT_ITEMS, type UiVariantKey } from "@/stories/ui-variant-presets";
import { VariantMatrix } from "@/stories/variant-matrix";

/** Одна story «Варианты» на компонент — RU-подписи, без смены id `DesignV2` / `Docs`. */
export function createVariantsStory(key: UiVariantKey): StoryObj<Record<string, never>> {
  const items = UI_VARIANT_ITEMS[key];
  return {
    name: "Варианты",
    parameters: { layout: "centered" },
    render: () => <VariantMatrix items={items} />
  };
}
