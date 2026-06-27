import type { Meta, StoryObj } from "@storybook/react";

import { BannerInline } from "@/components/ui/banner-inline";

import { CallStage } from "./call-stage";
import { CALL_STAGE_MOCK } from "./call-stage.mocks";

const meta: Meta<typeof CallStage> = {
  title: "Widgets/Звонок",
  component: CallStage,
  parameters: { layout: "fullscreen" }
};

export default meta;
type Story = StoryObj<typeof CallStage>;

// Static twin: controls disabled behind the preview banner (no fake affordances);
// the live runtime container renders the same CallStage with real handlers.
export const Grid: Story = {
  name: "Сетка",
  render: () => (
    <div className="call-screen">
      <BannerInline variant="warn">Превью — бэкенд не подключён</BannerInline>
      <CallStage
        view={CALL_STAGE_MOCK}
        controls={{ micOn: true, cameraOn: false }}
        disabled
      />
    </div>
  )
};

export const Reconnecting: Story = {
  name: "Переподключение",
  render: () => (
    <div className="call-screen">
      <BannerInline variant="warn">Превью — бэкенд не подключён</BannerInline>
      <CallStage
        view={{ ...CALL_STAGE_MOCK, phase: "reconnecting" }}
        controls={{ micOn: false, cameraOn: false }}
        disabled
      />
    </div>
  )
};
