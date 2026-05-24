import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta: Meta = {
  title: "UI/Sonner",
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj;

export const ToastDemo: Story = {
  render: () => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast.success("Сохранено")}>Success</Button>
        <Button variant="outline" onClick={() => toast.error("Ошибка")}>
          Error
        </Button>
        <Button variant="secondary" onClick={() => toast.info("Информация")}>
          Info
        </Button>
      </div>
      <Toaster richColors closeButton />
    </>
  )
};
