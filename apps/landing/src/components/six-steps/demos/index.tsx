import type { LandingLocale } from "../../../lib/landing-i18n";
import type { DemoType } from "../steps";
import { CapacityCheckDemo } from "./CapacityCheckDemo";
import { DealCreationDemo } from "./DealCreationDemo";
import { LessonsTemplateDemo } from "./LessonsTemplateDemo";
import { LiveScheduleDemo } from "./LiveScheduleDemo";
import { ManagementSignalDemo } from "./ManagementSignalDemo";
import { ProjectDraftDemo } from "./ProjectDraftDemo";

export function StepMiniDemo({
  demoType,
  active,
  locale = "ru",
}: {
  demoType: DemoType;
  active: boolean;
  locale?: LandingLocale;
}) {
  switch (demoType) {
    case "deal":
      return <DealCreationDemo active={active} locale={locale} />;
    case "draft":
      return <ProjectDraftDemo active={active} locale={locale} />;
    case "capacity":
      return <CapacityCheckDemo active={active} locale={locale} />;
    case "gantt":
      return <LiveScheduleDemo active={active} locale={locale} />;
    case "signal":
      return <ManagementSignalDemo active={active} locale={locale} />;
    case "closure":
      return <LessonsTemplateDemo active={active} locale={locale} />;
    default:
      return null;
  }
}