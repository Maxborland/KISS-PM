import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  API_CONTRACT_ENTRIES,
  API_CONTRACT_GET_ROUTES
} from "@/lib/mock-data/api-contract-registry";
import { getFixtureBundle, type FixtureBundle } from "@/lib/mock-data/fixture-bundle";
import { SCENARIO_NAMES } from "@/lib/mock-data/scenarios";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
const coverageDir = join(webRoot, ".storybook-verify-tmp");
const coverageFile = join(coverageDir, "api-contract-coverage.json");

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

  it("keeps MSW routes aligned with contract registry", () => {
    const registryRoutes = new Set(
      API_CONTRACT_ENTRIES.map((entry) => entry.route.replace(/:projectId/g, ":projectId"))
    );
    const mswRoutes = new Set(
      API_CONTRACT_GET_ROUTES.map((route) => route.replace(/:projectId/g, ":projectId"))
    );

    for (const route of registryRoutes) {
      expect(mswRoutes.has(route), `MSW missing route ${route}`).toBe(true);
    }
  });

  it("supports all scenario names on fixture bundle", () => {
    for (const name of SCENARIO_NAMES) {
      const bundle = getFixtureBundle(name);
      expect(bundle.projects).toBeInstanceOf(Array);
      expect(bundle.opportunities).toBeInstanceOf(Array);
    }
    expect(getFixtureBundle("empty").projects).toHaveLength(0);
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
    writeFileSync(coverageFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), coverage }, null, 2)}\n`, "utf8");

    expect(coverage.length).toBeGreaterThanOrEqual(API_CONTRACT_ENTRIES.length);
    expect(coverage.every((row) => row.route.startsWith("/api/"))).toBe(true);
  });
});
