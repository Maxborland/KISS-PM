import type { DemoStep } from "../../demo/machine";
import type { DemoFixture } from "../../demo/fixture";
import { CrmListScreen } from "./screens/CrmListScreen";
import { CrmDealScreen } from "./screens/CrmDealScreen";
import { IntakeScreen } from "./screens/IntakeScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { TaskScreen } from "./screens/TaskScreen";
import { SignalScreen } from "./screens/SignalScreen";
import { ActionScreen } from "./screens/ActionScreen";
import { AuditScreen } from "./screens/AuditScreen";

interface Props {
  step: DemoStep;
  fixture: DemoFixture;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function DemoStage({ step, fixture, onAdvance, onExplore }: Props) {
  switch (step) {
    case "crm-list":
      return <CrmListScreen deals={fixture.deals} onAdvance={onAdvance} onExplore={onExplore} />;
    case "crm-deal":
      return <CrmDealScreen deal={fixture.deals[0]!} onAdvance={onAdvance} onExplore={onExplore} />;
    case "intake":
      return <IntakeScreen intake={fixture.intake} onAdvance={onAdvance} />;
    case "project":
      return <ProjectScreen project={fixture.project} onAdvance={onAdvance} onExplore={onExplore} />;
    case "task":
      return <TaskScreen task={fixture.task} onAdvance={onAdvance} onExplore={onExplore} />;
    case "signal":
      return <SignalScreen signal={fixture.signal} onAdvance={onAdvance} />;
    case "action":
      return <ActionScreen action={fixture.action} onAdvance={onAdvance} onExplore={onExplore} />;
    case "audit":
      return <AuditScreen audit={fixture.audit} />;
  }
}
