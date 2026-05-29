import { describe, expect, it } from "vitest";

import { RESOURCE_MATRIX_MOCK } from "./mock-data";
import { filterVisibleMatrixRows } from "./use-matrix-visible-rows";

describe("filterVisibleMatrixRows", () => {
  it("показывает все строки при пустом collapsed", () => {
    const visible = filterVisibleMatrixRows(RESOURCE_MATRIX_MOCK.rows, new Set());
    expect(visible.length).toBe(RESOURCE_MATRIX_MOCK.rows.length);
  });

  it("скрывает дочерние строки при свёрнутой мастерской", () => {
    const visible = filterVisibleMatrixRows(RESOURCE_MATRIX_MOCK.rows, new Set(["g-workshop"]));
    expect(visible.map((v) => v.row.id)).toEqual(["g-workshop"]);
  });

  it("скрывает только сотрудников при свёрнутой роли", () => {
    const visible = filterVisibleMatrixRows(RESOURCE_MATRIX_MOCK.rows, new Set(["g-arch"]));
    const ids = visible.map((v) => v.row.id);
    expect(ids).toContain("g-workshop");
    expect(ids).toContain("g-arch");
    expect(ids).not.toContain("p-be");
    expect(ids).toContain("g-visual");
  });
});
