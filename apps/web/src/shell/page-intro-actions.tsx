import { Download, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Демо-действия для PageIntro (Storybook / slice без API). */
export function PageIntroActions() {
  return (
    <>
      <Button variant="secondary" size="sm" disabled title="Демо Storybook: экспорт подключится к API">
        <Download className="size-4" aria-hidden />
        Экспорт
      </Button>
      <Button variant="primary" size="sm" disabled title="Демо Storybook: создание сущности в продукте">
        <Plus className="size-4" aria-hidden />
        Создать
      </Button>
    </>
  );
}
