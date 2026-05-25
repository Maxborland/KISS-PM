import { AlertTriangle } from "lucide-react";

import { PageIntro } from "@/views/layout/page-intro";

export function SpaceDisciplineBlock() {
  return (
    <>
      <PageIntro
        title="Наложение вместо сдвига"
        lead="Уведомления, баннеры, фильтры не должны сдвигать контент. Только наложение поверх."
      />
      <div className="grid-compare">
        <div>
          <h3 className="type-h3">Нельзя</h3>
          <div className="banner-inline">
            <AlertTriangle className="size-4 inline" aria-hidden />
            {" "}
            Баннер сдвигает контент вниз
          </div>
          <div className="demo-box">Таблица</div>
        </div>
        <div>
          <h3 className="type-h3">Нужно</h3>
          <div className="demo-box">Таблица на месте</div>
        </div>
      </div>
    </>
  );
}
