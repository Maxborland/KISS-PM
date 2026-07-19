import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("project delivery non-schedule action links", () => {
  it("baseline overlay action navigates to the project schedule route", () => {
    const source = read("src/delivery/baseline/baseline-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/schedule`\}>Слой в «Графике»<\/Link>/);
    expect(source).not.toContain("Наложение базового плана на «График» появится");
  });

  it("calendar conflict action navigates to the project schedule route", () => {
    const source = read("src/delivery/calendars/calendars-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/schedule`\}>Открыть График<\/Link>/);
    expect(source).not.toContain("Переход к «Графику» отсюда появится");
  });

  it("settings calendar action navigates to the project calendars route", () => {
    const source = read("src/delivery/settings/settings-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/calendars`\}>Открыть Календарь<\/Link>/);
    expect(source).not.toContain('demoAction("переход на вкладку «Календари»")');
  });

  it("calendars no-calendar empty state links to the project settings route", () => {
    const source = read("src/delivery/calendars/calendars-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/settings`\}>Настроить календарь<\/Link>/);
  });

  it("assignments no-calendar banner links to the project settings route", () => {
    const source = read("src/delivery/assignments/assignments-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/settings`\}>Настроить календарь<\/Link>/);
  });
});

describe("project schedule toolbar action contract", () => {
  it("uses a real baseline link and does not expose fake filter or column controls", () => {
    const source = read("src/delivery/schedule/schedule-surface.tsx");

    expect(source).toMatch(/<Link href=\{`\/projects\/\$\{projectId\}\/baseline`\}>Baseline<\/Link>/);
    expect(source).not.toContain('demoAction("снимок baseline")');
    expect(source).not.toContain('demoAction("фильтры")');
    expect(source).not.toContain('demoAction("настройка колонок")');
    expect(source).not.toContain(">Фильтры</Button>");
    expect(source).not.toContain(">Колонки</Button>");
  });
});
