import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), "src/components/ui");
let patched = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".stories.tsx"))) {
  const key = file.replace(/\.stories\.tsx$/, "");
  const path = join(dir, file);
  let source = readFileSync(path, "utf8");
  if (source.includes("createVariantsStory")) {
    continue;
  }

  const importLine = 'import { createVariantsStory } from "@/stories/createVariantsStory";\n';
  const lastImportMatch = [...source.matchAll(/^import .+;?\s*$/gm)].pop();
  if (!lastImportMatch) {
    console.warn("skip (no imports):", file);
    continue;
  }
  const insertAt = lastImportMatch.index + lastImportMatch[0].length;
  source = `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  source = `${source.trimEnd()}\n\nexport const Variants = createVariantsStory("${key}");\n`;
  writeFileSync(path, source);
  patched += 1;
}

console.log(JSON.stringify({ patched, dir: "src/components/ui" }, null, 2));
