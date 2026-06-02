import { describe, expect, it } from "vitest";

import { getFixtureBundle } from "@/lib/mock-data/fixture-bundle";
import { resolveProjectsListSources } from "@/views/blocks/projects-list-block";

describe("ProjectsListBlock data sources", () => {
  it("uses Storybook scenario fixtures by default", () => {
    const fixtures = getFixtureBundle("default");

    expect(resolveProjectsListSources(fixtures)).toEqual({
      projects: fixtures.projects,
      projectTemplates: fixtures.projectTemplates
    });
  });

  it("uses live runtime projects when provided", () => {
    const fixtures = getFixtureBundle("default");
    const liveProjects = [{ ...fixtures.projects[0]!, id: "project-live" }];

    expect(resolveProjectsListSources(fixtures, { projects: liveProjects })).toEqual({
      projects: liveProjects,
      projectTemplates: fixtures.projectTemplates
    });
  });

  it("keeps explicit runtime project templates instead of falling back to fixtures", () => {
    const fixtures = getFixtureBundle("default");
    const liveProjects = [{ ...fixtures.projects[0]!, id: "project-live" }];

    expect(
      resolveProjectsListSources(fixtures, {
        projects: liveProjects,
        projectTemplates: []
      })
    ).toEqual({
      projects: liveProjects,
      projectTemplates: []
    });
  });
});
