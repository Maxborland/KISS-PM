import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "ui");

const components = [
  "alert",
  "avatar",
  "badge",
  "banner-inline",
  "breadcrumb",
  "card",
  "checkbox",
  "chip",
  "combobox",
  "command",
  "command-dialog",
  "context-menu",
  "date-input",
  "dialog",
  "dropdown-menu",
  "empty-state",
  "error-state",
  "forbidden-state",
  "form",
  "icon-button",
  "illu-state",
  "input",
  "kbd",
  "label",
  "loading-state",
  "page-intro",
  "pagination",
  "popover",
  "radio-group",
  "scroll-area",
  "search-pill",
  "segmented",
  "select",
  "separator",
  "sheet",
  "skeleton",
  "sonner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "tooltip"
];

for (const name of components) {
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const importName =
    name === "banner-inline"
      ? "BannerInline"
      : name === "empty-state"
        ? "EmptyState"
        : name === "illu-state"
          ? "IlluState"
          : name === "error-state"
            ? "ErrorState"
            : name === "forbidden-state"
              ? "ForbiddenState"
              : name === "loading-state"
                ? "LoadingState"
                : name === "page-intro"
                  ? "PageIntro"
                  : name === "icon-button"
                    ? "IconButton"
                    : name === "search-pill"
                      ? "SearchPill"
                      : name === "date-input"
                        ? "DateInput"
                        : name === "command-dialog"
                          ? "CommandDialog"
                          : pascal;

  const storyPath = join(root, `${name}.stories.tsx`);
  if (existsSync(storyPath)) continue;

  const content = `import type { Meta, StoryObj } from "@storybook/react";

import { ${importName} } from "./${name}";

const meta: Meta<typeof ${importName}> = {
  title: "UI/${pascal}",
  component: ${importName},
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof ${importName}>;

export const Docs: Story = {
  render: () => (
    <p className="text-[var(--text-sm)] text-[var(--muted)] max-w-md text-center">
      См. также <strong>Catalog/All Components</strong> для согласования в контексте.
    </p>
  )
};
`;

  mkdirSync(dirname(storyPath), { recursive: true });
  writeFileSync(storyPath, content, "utf8");
  console.log("wrote", storyPath);
}

console.log("done");
