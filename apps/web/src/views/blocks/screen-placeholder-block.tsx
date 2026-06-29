import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/domain/card-panel";
import { PageIntro } from "@/views/layout/page-intro";
import { demoAction } from "@/views/lib/demo";

export type ScreenPlaceholderBlockProps = {
  title: string;
  lead: string;
  hint?: string;
};

export function ScreenPlaceholderBlock({ title, lead, hint }: ScreenPlaceholderBlockProps) {
  return (
    <>
      <PageIntro title={title} lead={lead} />
      <CardPanel title="Контент экрана" subtitle={hint ?? "Экран в разработке"}>
        <p className="u-text-sm u-text-muted">
          Полный контент экрана появится в рабочем приложении.
        </p>
        <div className="state-empty__actions u-mt-4">
          <Button variant="primary" {...demoAction("основное действие")}>Основное действие</Button>
          <Button variant="secondary" {...demoAction("вторичное действие")}>Вторичное</Button>
        </div>
      </CardPanel>
    </>
  );
}
