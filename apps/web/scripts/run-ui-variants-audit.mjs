import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, ".storybook-verify-tmp");
mkdirSync(outDir, { recursive: true });

const index = JSON.parse(readFileSync(join(root, "storybook-static/index.json"), "utf8"));

const byTitle = new Map();
for (const entry of Object.values(index.entries)) {
  if (!entry.title?.startsWith("UI/")) continue;
  const list = byTitle.get(entry.title) ?? [];
  list.push(entry);
  byTitle.set(entry.title, list);
}

const rows = [...byTitle.entries()].map(([title, entries]) => {
  const stories = entries.filter((e) => e.type === "story");
  const variants = stories.find((e) => e.id?.endsWith("--variants"));
  const onlyVitrina = stories.length === 1 && stories[0]?.id?.includes("design-v-2");
  return {
    title,
    storyCount: stories.length,
    hasVariants: Boolean(variants),
    variantsId: variants?.id ?? null,
    pass: Boolean(variants) && !onlyVitrina
  };
});

const fail = rows.filter((r) => !r.pass);

const audit = {
  batch: "13c",
  date: "2026-05-24",
  uiGroups: rows.length,
  passCount: rows.filter((r) => r.pass).length,
  fail,
  pass: fail.length === 0,
  sampleVariantsId: "ui-button--variants"
};

writeFileSync(join(outDir, "batch13c-ui-variants-evidence.json"), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (!audit.pass) process.exit(1);
