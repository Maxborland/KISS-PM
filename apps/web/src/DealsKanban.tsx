"use client";

import {
  closestCorners,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  ArrowRightLeft,
  CalendarDays,
  GripVertical,
  Loader2,
  UserRound
} from "lucide-react";
import { useMemo, useState } from "react";

import type { DealStage, Opportunity } from "./api";
import {
  buildOpportunityKanbanCardViewModel,
  canMoveOpportunityToStage,
  getOpportunityStageMoveBlocker,
  getOpportunityStageOptions
} from "./opportunityDisplay";
import { StatusPill } from "./components/workspace-ui";
import { formatMoney } from "./workspaceViewHelpers";
import type { WorkspaceData } from "./workspaceData";

export function DealsKanban(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunities: Opportunity[];
  stages: DealStage[];
  onOpenOpportunity: (opportunityId: string) => void;
  onUpdateStage: (opportunity: Opportunity, stageId: string) => Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );
  const [draggingOpportunityId, setDraggingOpportunityId] = useState<string | null>(null);
  const [activeDropStageId, setActiveDropStageId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    opportunityId: string;
    stageId: string;
  } | null>(null);

  const opportunitiesByStage = useMemo(() => {
    const grouped = new Map<string, Opportunity[]>();
    for (const stage of props.stages) grouped.set(stage.id, []);
    for (const opportunity of props.opportunities) {
      const stageId = opportunity.stageId;
      if (!stageId || !grouped.has(stageId)) continue;
      grouped.get(stageId)?.push(opportunity);
    }
    return grouped;
  }, [props.opportunities, props.stages]);
  const draggingOpportunity = draggingOpportunityId
    ? props.opportunities.find((item) => item.id === draggingOpportunityId) ?? null
    : null;

  if (props.stages.length === 0) {
    return <p className="empty-state">Создайте хотя бы один этап сделки для канбана.</p>;
  }

  async function moveOpportunity(opportunity: Opportunity, targetStageId: string) {
    if (!canMoveOpportunityToStage({
      canManageOpportunities: props.canManageOpportunities,
      dealStages: props.data.dealStages,
      isPending: props.isPending || Boolean(pendingMove),
      opportunity,
      targetStageId
    })) {
      return;
    }

    setPendingMove({ opportunityId: opportunity.id, stageId: targetStageId });
    try {
      await props.onUpdateStage(opportunity, targetStageId);
    } finally {
      setPendingMove(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingOpportunityId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    setActiveDropStageId(getStageIdFromDragOver(event));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const opportunityId = String(event.active.id);
    const targetStageId = getStageIdFromDragOver(event);
    setDraggingOpportunityId(null);
    setActiveDropStageId(null);
    if (!targetStageId) return;

    const opportunity = props.opportunities.find((item) => item.id === opportunityId);
    if (!opportunity) return;
    await moveOpportunity(opportunity, targetStageId);
  }

  return (
    <DndContext
      collisionDetection={kanbanCollisionDetection}
      sensors={sensors}
      onDragCancel={() => {
        setDraggingOpportunityId(null);
        setActiveDropStageId(null);
      }}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
    >
      <div className="deal-kanban" aria-label="Канбан сделок">
        {props.stages.map((stage) => (
          <DealKanbanColumn
            activeDropStageId={activeDropStageId}
            canManageOpportunities={props.canManageOpportunities}
            data={props.data}
            draggingOpportunityId={draggingOpportunityId}
            isPending={props.isPending}
            key={stage.id}
            opportunities={opportunitiesByStage.get(stage.id) ?? []}
            pendingMove={pendingMove}
            stage={stage}
            onMove={moveOpportunity}
            onOpenOpportunity={props.onOpenOpportunity}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingOpportunity ? (
          <DealKanbanCardPreview data={props.data} opportunity={draggingOpportunity} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DealKanbanColumn(props: {
  activeDropStageId: string | null;
  canManageOpportunities: boolean;
  data: WorkspaceData;
  draggingOpportunityId: string | null;
  isPending: boolean;
  opportunities: Opportunity[];
  pendingMove: { opportunityId: string; stageId: string } | null;
  stage: DealStage;
  onMove: (opportunity: Opportunity, stageId: string) => Promise<void>;
  onOpenOpportunity: (opportunityId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: props.stage.id,
    data: { stageId: props.stage.id },
    disabled: props.stage.status !== "active"
  });
  const isActiveDrop = isOver || props.activeDropStageId === props.stage.id;
  const stageTotal = props.opportunities.reduce(
    (sum, opportunity) => sum + opportunity.contractValue,
    0
  );

  return (
    <section
      aria-label={`Этап ${props.stage.name}`}
      className={[
        "deal-kanban-column",
        props.draggingOpportunityId ? "is-drop-ready" : "",
        isActiveDrop ? "is-drop-active" : "",
        props.stage.status === "archived" ? "is-archived" : ""
      ].filter(Boolean).join(" ")}
      ref={setNodeRef}
    >
      <header>
        <span>
          <strong>
            {props.stage.status === "archived" ? `${props.stage.name} · архив` : props.stage.name}
          </strong>
          <small>
            {props.opportunities.length} сделок · {formatMoney(stageTotal)}
          </small>
        </span>
        <span className="deal-kanban-counter">{props.opportunities.length}</span>
      </header>
      <div className="deal-card-list" data-stage-id={props.stage.id}>
        {props.opportunities.length === 0 ? (
          <p className="empty-state compact">Нет сделок на этапе</p>
        ) : (
          props.opportunities.map((opportunity) => (
            <DealKanbanCard
              canManageOpportunities={props.canManageOpportunities}
              data={props.data}
              isDragging={props.draggingOpportunityId === opportunity.id}
              isPending={props.isPending}
              key={opportunity.id}
              opportunity={opportunity}
              pendingMove={props.pendingMove}
              onMove={props.onMove}
              onOpenOpportunity={props.onOpenOpportunity}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DealKanbanCard(props: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isDragging: boolean;
  isPending: boolean;
  opportunity: Opportunity;
  pendingMove: { opportunityId: string; stageId: string } | null;
  onMove: (opportunity: Opportunity, stageId: string) => Promise<void>;
  onOpenOpportunity: (opportunityId: string) => void;
}) {
  const disabledReason = getCardMoveDisabledReason({
    canManageOpportunities: props.canManageOpportunities,
    data: props.data,
    isPending: props.isPending || Boolean(props.pendingMove),
    opportunity: props.opportunity
  });
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform } = useDraggable({
    id: props.opportunity.id,
    disabled: Boolean(disabledReason),
    data: {
      currentStageId: props.opportunity.stageId
    }
  });
  const card = buildOpportunityKanbanCardViewModel(props.data, props.opportunity);
  const isMoving = props.pendingMove?.opportunityId === props.opportunity.id;

  return (
    <article
      className={[
        "deal-card",
        props.isDragging ? "is-dragging" : "",
        isMoving ? "is-moving" : ""
      ].filter(Boolean).join(" ")}
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
    >
      <div className="deal-card-main">
        <button
          className="inline-link-button"
          type="button"
          onClick={() => props.onOpenOpportunity(props.opportunity.id)}
        >
          {props.opportunity.title}
        </button>
        <small>{card.clientLabel}</small>
        <span className="deal-card-contact">
          <UserRound aria-hidden="true" size={12} />
          {card.contactLabel}
        </span>
      </div>
      <div className="deal-card-facts" aria-label={card.periodLabel}>
        <span>
          <CalendarDays aria-hidden="true" size={12} />
          {card.periodLabel}
        </span>
      </div>
      <div
        aria-label={`Экономика сделки: необходимые часы ${card.plannedHoursLabel}; стоимость ${card.contractValueLabel}; плановая норма часа ${card.plannedHourlyRateLabel}`}
        className="deal-card-economics"
      >
        <strong>{card.contractValueLabel}</strong>
        <span>{card.plannedHoursLabel}</span>
        <span>{card.plannedHourlyRateLabel}</span>
      </div>
      <div className="deal-card-feasibility">
        <StatusPill label={card.feasibilityLabel} tone={card.feasibilityTone} />
      </div>
      <div className="deal-card-stage-controls">
        <button
          aria-label={
            disabledReason
              ? `Перенос сделки недоступен: ${disabledReason}`
              : `Перетащить сделку ${props.opportunity.title}`
          }
          className="drag-handle-button"
          disabled={Boolean(disabledReason)}
          ref={setActivatorNodeRef}
          title={disabledReason ?? "Перетащите в другой этап"}
          type="button"
          {...attributes}
          {...listeners}
        >
          {isMoving ? <Loader2 aria-hidden="true" size={14} /> : <GripVertical aria-hidden="true" size={14} />}
          <span>{isMoving ? "Переносим" : "DnD"}</span>
        </button>
        <label htmlFor={`${props.opportunity.id}-stage`}>
          <span className="sr-only">Сменить этап без перетаскивания</span>
          <select
            id={`${props.opportunity.id}-stage`}
            disabled={Boolean(disabledReason)}
            title={disabledReason ?? "Сменить этап без перетаскивания"}
            value={props.opportunity.stageId ?? ""}
            onChange={(event) => props.onMove(props.opportunity, event.target.value)}
          >
            {getOpportunityStageOptions(props.data.dealStages, props.opportunity).map((item) => (
              <option key={item.id} value={item.id}>
                {item.status === "archived" ? `${item.name} · архив` : item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {disabledReason ? (
        <p className="deal-card-disabled-reason">{disabledReason}</p>
      ) : (
        <p className="deal-card-move-hint">
          <ArrowRightLeft aria-hidden="true" size={12} />
          Перетащите за ручку или выберите этап
        </p>
      )}
    </article>
  );
}

function DealKanbanCardPreview(props: {
  data: WorkspaceData;
  opportunity: Opportunity;
}) {
  const card = buildOpportunityKanbanCardViewModel(props.data, props.opportunity);

  return (
    <article className="deal-card deal-card-overlay">
      <div className="deal-card-main">
        <strong>{props.opportunity.title}</strong>
        <small>{card.clientLabel}</small>
      </div>
      <div className="deal-card-economics">
        <strong>{card.contractValueLabel}</strong>
        <span>{card.plannedHoursLabel}</span>
      </div>
    </article>
  );
}

function getStageIdFromDragOver(event: DragEndEvent | DragOverEvent): string | null {
  if (!event.over) return null;
  const stageId = event.over.data.current?.stageId;
  return typeof stageId === "string" ? stageId : String(event.over.id);
}

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const intersections = rectIntersection(args);
  if (intersections.length > 0) return intersections;

  return closestCorners(args);
};

function getCardMoveDisabledReason(input: {
  canManageOpportunities: boolean;
  data: WorkspaceData;
  isPending: boolean;
  opportunity: Opportunity;
}): string | null {
  if (!input.canManageOpportunities) {
    return "Нужно право tenant.opportunities.manage";
  }
  if (input.isPending) {
    return "Дождитесь завершения текущего действия";
  }
  const activeTarget = input.data.dealStages.find(
    (stage) => stage.status === "active" && stage.id !== input.opportunity.stageId
  );
  if (!activeTarget) return "Нет доступного активного этапа для переноса";

  return getOpportunityStageMoveBlocker({
    canManageOpportunities: input.canManageOpportunities,
    dealStages: input.data.dealStages,
    isPending: input.isPending,
    opportunity: input.opportunity,
    targetStageId: activeTarget.id
  });
}
