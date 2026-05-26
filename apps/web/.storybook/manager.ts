import { addons } from "@storybook/manager-api";

import { renderSidebarLabelRu } from "./sidebarLabelsRu";

/**
 * RU sidebar без смены story id (title остаётся UI/Button → ui-button--*).
 * @see DESIGN_CONTRACT §1
 */
addons.setConfig({
  sidebar: {
    renderLabel: (item) => renderSidebarLabelRu(item)
  }
});
