import type { ReactNode } from "react";
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

function ScreenWrap({ children }: { children: ReactNode }) {
  return <div className="sandbox__screen-wrap">{children}</div>;
}

export function DemoStage({ step, fixture, onAdvance, onExplore }: Props) {
  switch (step) {
    case "crm-list":
      return (
        <ScreenWrap>
          <CrmListScreen deals={fixture.deals} onAdvance={onAdvance} onExplore={onExplore} />
        </ScreenWrap>
      );
    case "crm-deal":
      return (
        <div className="sandbox__deal-wrap">
          <CrmDealScreen deal={fixture.deals[0]!} onAdvance={onAdvance} onExplore={onExplore} />
        </div>
      );
    case "intake":
      return (
        <ScreenWrap>
          <IntakeScreen intake={fixture.intake} onAdvance={onAdvance} />
        </ScreenWrap>
      );
    case "project":
      return (
        <ScreenWrap>
          <ProjectScreen project={fixture.project} onAdvance={onAdvance} onExplore={onExplore} />
        </ScreenWrap>
      );
    case "task":
      return (
        <ScreenWrap>
          <TaskScreen task={fixture.task} onAdvance={onAdvance} onExplore={onExplore} />
        </ScreenWrap>
      );
    case "signal":
      return (
        <ScreenWrap>
          <SignalScreen signal={fixture.signal} onAdvance={onAdvance} />
        </ScreenWrap>
      );
    case "action":
      return (
        <ScreenWrap>
          <ActionScreen action={fixture.action} onAdvance={onAdvance} onExplore={onExplore} />
        </ScreenWrap>
      );
    case "audit":
      return (
        <ScreenWrap>
          <AuditScreen audit={fixture.audit} />
        </ScreenWrap>
      );
  }
}
