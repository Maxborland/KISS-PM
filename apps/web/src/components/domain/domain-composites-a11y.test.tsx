import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CapacityBar } from "./capacity-bar";
import { DateRange } from "./date-range";
import { DependencyChip } from "./dependency-chip";
import { HeatmapCell } from "./heatmap-cell";
import { KpiTile } from "./kpi-tile";
import { MoneyValue } from "./money-value";
import { ParticipantList } from "./participant-list";

describe("Domain composites a11y markup", () => {
  it("KpiTile renders label and mono value", () => {
    const html = renderToStaticMarkup(<KpiTile label="Маржа" value="42%" />);
    expect(html).toContain("Маржа");
    expect(html).toContain("mono");
  });

  it("HeatmapCell exposes aria-label", () => {
    const html = renderToStaticMarkup(<HeatmapCell value={80} level={3} title="80%" />);
    expect(html).toContain('aria-label="80%"');
  });

  it("DateRange display uses formatted range", () => {
    const html = renderToStaticMarkup(
      <DateRange mode="display" start="2026-05-01" finish="2026-05-26" />
    );
    expect(html).toContain("date-range__text");
  });

  it("MoneyValue uses mono", () => {
    const html = renderToStaticMarkup(<MoneyValue amount={1000} />);
    expect(html).toContain("money-value mono");
  });

  it("CapacityBar exposes progressbar", () => {
    const html = renderToStaticMarkup(<CapacityBar label="Иванов" used={30} capacity={40} />);
    expect(html).toContain('role="progressbar"');
  });

  it("DependencyChip shows predecessor token", () => {
    const html = renderToStaticMarkup(<DependencyChip rowNumber={3} lagDays={2} />);
    expect(html).toContain("3+2d");
  });

  it("ParticipantList detailed exposes list semantics", () => {
    const html = renderToStaticMarkup(
      <ParticipantList
        participants={[{ id: "1", name: "Иванов", initials: "ИВ" }]}
        layout="detailed"
      />
    );
    expect(html).toContain('aria-label="Участники"');
  });

  it("ParticipantList compact renders only avatar group", () => {
    const html = renderToStaticMarkup(
      <ParticipantList
        participants={[{ id: "1", name: "Иванов", initials: "ИВ" }]}
        layout="compact"
      />
    );
    expect(html).toContain("participant-list--compact");
    expect(html).not.toContain("participant-list__row");
  });
});
