import type { DemoType } from "../steps";
import { CapacityCheckDemo } from "./CapacityCheckDemo";
import { DealCreationDemo } from "./DealCreationDemo";
import { LessonsTemplateDemo } from "./LessonsTemplateDemo";
import { LiveScheduleDemo } from "./LiveScheduleDemo";
import { ManagementSignalDemo } from "./ManagementSignalDemo";
import { ProjectDraftDemo } from "./ProjectDraftDemo";

export function StepMiniDemo({ demoType, active }: { demoType: DemoType; active: boolean }) {
  switch (demoType) {
    case "deal":
      return <DealCreationDemo active={active} />;
    case "draft":
      return <ProjectDraftDemo active={active} />;
    case "capacity":
      return <CapacityCheckDemo active={active} />;
    case "gantt":
      return <LiveScheduleDemo active={active} />;
    case "signal":
      return <ManagementSignalDemo active={active} />;
    case "closure":
      return <LessonsTemplateDemo active={active} />;
    default:
      return null;
  }
}
