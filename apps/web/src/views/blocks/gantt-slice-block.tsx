"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Link2,
  Plus,
  Save,
  Trash2,
  Unlink
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PageIntro } from "@/views/layout/page-intro";
import { GANTT_MOCK, Gantt } from "@/widgets/gantt";

export type GanttSliceBlockProps = {
  title: string;
  lead: string;
};

export function GanttSliceBlock({ title, lead }: GanttSliceBlockProps) {
  const [zoom, setZoom] = useState<"hour" | "day" | "week" | "month">("day");

  return (
    <>
      <PageIntro
        title={title}
        lead={lead}
        actions={
          <>
            <Button variant="ghost" size="sm">
              <Calendar className="size-4" aria-hidden />
              Май 2026
            </Button>
            <Button variant="primary" size="sm">
              <Save className="size-4" aria-hidden />
              Сохранить
            </Button>
          </>
        }
      />
      <div className="gantt-toolbar" role="toolbar" aria-label="Действия Ганта">
        <div className="gantt-toolbar__group">
          <Button variant="ghost" size="icon-sm" aria-label="Добавить">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Удалить">
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="gantt-toolbar__group">
          <Button variant="ghost" size="icon-sm" aria-label="Уровень выше">
            <ChevronUp className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Уровень глубже">
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <div className="gantt-toolbar__group">
          <Button variant="ghost" size="icon-sm" aria-label="Связать">
            <Link2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Снять связь">
            <Unlink className="size-4" />
          </Button>
        </div>
        <span className="gantt-toolbar__sep" />
        <Button variant="ghost" size="sm">
          крит. путь
        </Button>
        <Button variant="ghost" size="sm">
          Базовый план
        </Button>
        <span className="gantt-toolbar__sep" />
        <Button variant="ghost" size="icon-sm" aria-label="Фильтр">
          <Filter className="size-4" />
        </Button>
        <div className="gantt-toolbar__spacer" />
        <Segmented
          name="gantt-zoom"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: "hour", label: "Час" },
            { value: "day", label: "День" },
            { value: "week", label: "Нед" },
            { value: "month", label: "Мес" }
          ]}
        />
      </div>
      <div className="gantt-stats">
        <span className="gantt-stats__item">
          <span className="gantt-stats__label">SPI</span>
          <span className="gantt-stats__value">0.94</span>
        </span>
        <span className="gantt-stats__item">
          <span className="gantt-stats__label">CPI</span>
          <span className="gantt-stats__value">1.02</span>
        </span>
        <span className="gantt-stats__item">
          <span className="gantt-stats__label">Прогресс</span>
          <span className="gantt-stats__value">62%</span>
        </span>
        <span className="gantt-stats__item">
          <span className="gantt-stats__label">Задач</span>
          <span className="gantt-stats__value">15</span>
        </span>
      </div>
      <Gantt data={GANTT_MOCK} zoom={zoom} />
    </>
  );
}
