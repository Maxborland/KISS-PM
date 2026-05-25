import { Button } from "@/components/ui/button";
import { CardPanel } from "@/components/domain/card-panel";
import { PageIntro } from "@/views/layout/page-intro";

export type ScreenPlaceholderBlockProps = {
  title: string;
  lead: string;
  hint?: string;
};

export function ScreenPlaceholderBlock({ title, lead, hint }: ScreenPlaceholderBlockProps) {
  return (
    <>
      <PageIntro title={title} lead={lead} />
      <CardPanel title="Контент экрана" subtitle={hint ?? "React-экран · паритет с эталоном design-v2"}>
        <p className="u-text-sm u-text-muted">
          Полный контент экрана подключается по мере фазы 2. Оболочка, заголовок страницы и токены уже согласованы.
        </p>
        <div className="state-empty__actions u-mt-4">
          <Button variant="primary">Основное действие</Button>
          <Button variant="secondary">Вторичное</Button>
        </div>
      </CardPanel>
    </>
  );
}
