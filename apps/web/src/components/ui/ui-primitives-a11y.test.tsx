import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Calendar } from "lucide-react";

import { AvatarGroup } from "./avatar-group";
import { IconPill } from "./icon-pill";
import { KbdShortcut } from "./kbd-shortcut";
import { NumericValue } from "./numeric-value";
import { ProgressBar } from "./progress-bar";
import { ProgressRing } from "./progress-ring";
import { Sparkline } from "./sparkline";
import { StatusDot } from "./status-dot";
import { TrendArrow } from "./trend-arrow";

describe("UI primitives a11y markup", () => {
  it("StatusDot exposes status role and label", () => {
    const html = renderToStaticMarkup(<StatusDot tone="success" label="В срок" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="В срок"');
  });

  it("AvatarGroup exposes group label", () => {
    const html = renderToStaticMarkup(
      <AvatarGroup items={[{ id: "1", initials: "ИП" }]} />
    );
    expect(html).toContain('aria-label="Участники"');
  });

  it("ProgressBar exposes aria-label on track", () => {
    const html = renderToStaticMarkup(<ProgressBar value={50} label="Выполнение" />);
    expect(html).toContain('aria-label="Выполнение"');
  });

  it("ProgressRing exposes progress label", () => {
    const html = renderToStaticMarkup(<ProgressRing value={40} />);
    expect(html).toContain('aria-label="Прогресс 40 процентов"');
  });

  it("TrendArrow exposes status role", () => {
    const html = renderToStaticMarkup(<TrendArrow direction="up" value="+5%" />);
    expect(html).toContain('role="status"');
  });

  it("Sparkline exposes img role", () => {
    const html = renderToStaticMarkup(<Sparkline points={[1, 2, 3]} />);
    expect(html).toContain('role="img"');
  });

  it("KbdShortcut exposes shortcut description", () => {
    const html = renderToStaticMarkup(<KbdShortcut keys={["⌘", "K"]} description="Поиск" />);
    expect(html).toContain("Поиск");
  });

  it("NumericValue renders tabular mono class", () => {
    const html = renderToStaticMarkup(<NumericValue value="42" unit="ч" />);
    expect(html).toContain("numeric-value");
    expect(html).toContain("mono");
  });

  it("IconPill exposes accessible name", () => {
    const html = renderToStaticMarkup(<IconPill icon={Calendar} label="Календарь" />);
    expect(html).toContain("Календарь");
  });
});
