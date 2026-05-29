import { readFileSync } from "node:fs";
import { join } from "node:path";

const indexPath = join(import.meta.dirname, "../storybook-static/index.json");
const index = JSON.parse(readFileSync(indexPath, "utf8"));
const roots = new Set();

for (const entry of Object.values(index.entries)) {
  const title = entry.title ?? "";
  const root = title.split("/")[0];
  if (root) roots.add(root);
}

const sorted = [...roots].sort();
console.log(JSON.stringify({ roots: sorted, count: sorted.length }, null, 2));
process.exit(sorted.length === 8 ? 0 : 1);
