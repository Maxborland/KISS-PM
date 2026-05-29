import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const webRoot = join(import.meta.dirname, "..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".stories.tsx")) out.push(path);
  }
  return out;
}

for (const file of walk(join(webRoot, "src"))) {
  let source = readFileSync(file, "utf8");
  let changed = false;
  if (source.includes('title: "UI/')) {
    source = source.replaceAll('title: "UI/', 'title: "Primitives/');
    changed = true;
  }
  if (source.includes('title: "Views/Screens"')) {
    source = source.replace('title: "Views/Screens"', 'title: "Screens"');
    changed = true;
  }
  if (source.includes('title: "Catalog/All Components"')) {
    source = source.replace(
      'title: "Catalog/All Components"',
      'title: "Foundations/Каталог компонентов"'
    );
    changed = true;
  }
  if (changed) writeFileSync(file, source);
}

const textFiles = [
  "src/lib/mock-data/api-contract-registry.ts",
  "src/__health__/api-contract.health.test.ts",
  "src/views/blocks/task-detail-drawer.tsx"
];

for (const rel of textFiles) {
  const path = join(webRoot, rel);
  let source = readFileSync(path, "utf8");
  if (!source.includes("views-screens--")) continue;
  source = source.replaceAll("views-screens--", "screens--");
  writeFileSync(path, source);
}

for (const name of readdirSync(join(webRoot, "scripts"))) {
  if (!name.endsWith(".mjs") || name === "phase8-rename-story-titles.mjs") continue;
  const path = join(webRoot, "scripts", name);
  let source = readFileSync(path, "utf8");
  if (!source.includes("views-screens--")) continue;
  source = source.replaceAll("views-screens--", "screens--");
  writeFileSync(path, source);
}

console.log("phase8-rename-story-titles: ok");
