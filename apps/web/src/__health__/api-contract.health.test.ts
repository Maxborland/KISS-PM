import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  API_CONTRACT_ENTRIES,
  API_CONTRACT_MSW_ROUTES
} from "@/lib/mock-data/api-contract-registry";
import { getFixtureBundle, type FixtureBundle } from "@/lib/mock-data/fixture-bundle";
import { SCENARIO_NAMES } from "@/lib/mock-data/scenarios";
import { STORYBOOK_MSW_HANDLER_PATHS } from "@/lib/mock-data/storybook-msw-routes";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const coverageDir = join(webRoot, ".storybook-verify-tmp");
const coverageFile = join(coverageDir, "api-contract-coverage.json");
const screensStoriesSource = readFileSync(
  join(webRoot, "src/views/screens/screens.stories.tsx"),
  "utf8"
);

function exportNameToStoryId(exportName: string): string {
  const kebab = exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return `screens--${kebab}`;
}

function collectViewsScreenStoryIds(source: string): Set<string> {
  const ids = new Set<string>();
  const pattern = /export const (\w+): Story/g;
  for (const match of source.matchAll(pattern)) {
    const exportName = match[1];
    if (exportName) ids.add(exportNameToStoryId(exportName));
  }
  return ids;
}

const VIEWS_SCREEN_STORY_IDS = collectViewsScreenStoryIds(screensStoriesSource);

function normalizeRoute(route: string): string {
  return route.replace(/:projectId/g, ":projectId");
}

function assertArrayFixture(label: string, value: unknown): void {
  expect(Array.isArray(value), `${label}: expected array fixture`).toBe(true);
}

describe("api-contract fixtures", () => {
  it("exposes typed default bundle for every registry entity", () => {
    const bundle = getFixtureBundle("default");
    const singletonKeys = new Set<keyof FixtureBundle>(["orgStructure", "productionCalendar"]);

    for (const entry of API_CONTRACT_ENTRIES) {
      const fixture = bundle[entry.fixtureKey];
      if (entry.responseKey === "(root)" || singletonKeys.has(entry.fixtureKey)) {
        expect(fixture, `${entry.entity}: missing singleton fixture`).toBeTruthy();
        continue;
      }
      assertArrayFixture(entry.entity, fixture);
    }
  });

  it("keeps MSW routes aligned with contract registry (real handler path list)", () => {
    const registryRoutes = new Set(API_CONTRACT_ENTRIES.map((entry) => normalizeRoute(entry.route)));
    const handlerRoutes = new Set(STORYBOOK_MSW_HANDLER_PATHS.map((route) => normalizeRoute(route)));
    const aliasRoutes = new Set(API_CONTRACT_MSW_ROUTES.map((route) => normalizeRoute(route)));

    expect(aliasRoutes).toEqual(handlerRoutes);

    for (const route of registryRoutes) {
      const covered = [...handlerRoutes].some(
        (handlerRoute) => handlerRoute === route || handlerRoute.startsWith(`${route.split(":")[0]}`)
      );
      expect(covered, `MSW missing route ${route}`).toBe(true);
    }
  });

  it("maps registry stories to existing Views/Screens story ids", () => {
    for (const entry of API_CONTRACT_ENTRIES) {
      for (const storyId of entry.stories) {
        if (!storyId.startsWith("screens--")) continue;
        expect(VIEWS_SCREEN_STORY_IDS.has(storyId), `unknown story id ${storyId}`).toBe(true);
      }
    }
  });

  it("supports all scenario names on fixture bundle", () => {
    for (const name of SCENARIO_NAMES) {
      const bundle = getFixtureBundle(name);
      expect(bundle.projects).toBeInstanceOf(Array);
      expect(bundle.opportunities).toBeInstanceOf(Array);
    }
    expect(getFixtureBundle("empty").projects).toHaveLength(0);
    expect(getFixtureBundle("overload").controlSignals.length).toBeGreaterThan(
      getFixtureBundle("default").controlSignals.length
    );
  });

  it("writes entity → fixture → route → story coverage map", () => {
    const bundle = getFixtureBundle("default");
    const coverage = API_CONTRACT_ENTRIES.map((entry) => {
      const fixture = bundle[entry.fixtureKey];
      const count = Array.isArray(fixture) ? fixture.length : fixture ? 1 : 0;
      return {
        entity: entry.entity,
        webType: entry.webType,
        fixtureExport: entry.fixtureExport,
        fixtureKey: entry.fixtureKey,
        fixtureCount: count,
        route: entry.route,
        responseKey: entry.responseKey,
        stories: entry.stories
      };
    });

    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(
      coverageFile,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), coverage }, null, 2)}\n`,
      "utf8"
    );

    expect(coverage.length).toBeGreaterThanOrEqual(API_CONTRACT_ENTRIES.length);
    expect(coverage.every((row) => row.route.startsWith("/api/"))).toBe(true);
  });
});
