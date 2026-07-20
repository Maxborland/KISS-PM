"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/domain/form-dialog";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { AdminFrame } from "@/admin/ui/admin-frame";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { useSessionUser } from "@/shell/use-session-user";
import { makeRuError } from "@/lib/error-messages";
import type { MutationResult } from "@/lib/domain-client";

import { useOrgStructure, type OrgStructureData } from "./use-org-structure";
import type { OrgStructureTrack } from "./org-structure-client";
import {
  buildEditModel,
  checkNodeName,
  emptyEditModel,
  isPlacementComplete,
  modelFingerprint,
  newNodeId,
  serializeModel,
  unitNounAccusative,
  unitNounNominative,
  type EditDirection,
  type EditModel,
  type EditPlacement,
  type EditTrack
} from "./org-structure-model";

const selCls =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60 [@media(pointer:coarse)]:min-h-[var(--touch-target)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// RU-коды ошибок оргструктуры (зеркало orgStructureRoutes/validation).
const orgErr = makeRuError(
  {
    tenant_org_structure_invalid: "Некорректная структура: проверьте названия узлов и расстановки",
    tenant_org_node_duplicate_id: "Внутренняя ошибка: повторяющийся идентификатор узла",
    tenant_org_node_invalid_type: "Недопустимый тип узла для этого трека",
    tenant_org_node_invalid_parent: "Узел привязан к неверному родителю",
    tenant_org_placement_duplicate_user: "Сотрудник расставлен дважды в одном треке",
    tenant_org_placement_invalid_direction: "Расстановка ссылается на несуществующее направление",
    tenant_org_placement_invalid_department: "Расстановка ссылается на несуществующий отдел",
    tenant_org_placement_invalid_team: "Расстановка ссылается на несуществующую команду",
    tenant_org_placement_invalid_user: "Расстановка ссылается на несуществующего сотрудника",
    tenant_org_placement_invalid_position: "Расстановка ссылается на несуществующую должность",
    permission_missing: "Недостаточно прав для управления оргструктурой"
  },
  "Не удалось сохранить оргструктуру"
);

const TRACK_LABEL: Record<OrgStructureTrack, string> = {
  functional: "Функциональная",
  project: "Проектная"
};

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * Admin «Оргструктура» — редактор двух треков оргструктуры тенанта на боевом
 * контракте GET/PUT /api/tenant/current/org-structure (full-replace).
 * Дерево: направление → единица (отдел для functional, команда для project) +
 * расстановка людей (направление·единица·должность). Чтение —
 * tenant.org_structure.read, управление — tenant.org_structure.manage.
 * После сохранения матрица загрузки /capacity группирует по реальной иерархии.
 */
export function OrgStructureSurface() {
  const { live } = useAdminRuntime();
  const { data, status, error, reload, save } = useOrgStructure();
  const sessionUser = useSessionUser();
  const canManage = sessionUser?.permissions.includes("tenant.org_structure.manage") ?? false;

  const surfaceStatus = surfaceStatusOf(status, data !== null);

  return (
    <AdminFrame
      activeTab="Оргструктура"
      subtitle="Направления, отделы и команды тенанта: по ним матрица загрузки группирует ёмкость и назначения"
    >
      <div data-testid="org-structure-page">
        {!live ? (
          <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">
              Прототип
            </span>
            <span>
              Реальный контракт: GET/PUT /api/tenant/current/org-structure (full-replace). Чтение —
              tenant.org_structure.read, управление — tenant.org_structure.manage.
            </span>
          </div>
        ) : null}

        <SurfaceState
          status={surfaceStatus}
          error={error}
          onRetry={() => void reload()}
          errorFormat={(code) => orgErr(code)}
          forbidden={{
            title: "Оргструктура недоступна",
            description: "Нужно право чтения оргструктуры (tenant.org_structure.read)."
          }}
        >
          {data ? <OrgStructureEditor data={data} canManage={canManage} onSave={save} /> : <></>}
        </SurfaceState>
      </div>
    </AdminFrame>
  );
}

// Иммутабельно заменяет активный трек в модели.
function withTrack(model: EditModel, track: OrgStructureTrack, next: EditTrack): EditModel {
  return { ...model, [track]: next };
}

/**
 * Презентационный редактор — состояние черновика держит сам (инициализируется из
 * снапшота). Вынесен из Surface, чтобы тестироваться без хука/транспорта.
 */
export function OrgStructureEditor({
  data,
  canManage,
  onSave
}: {
  data: OrgStructureData;
  canManage: boolean;
  onSave: (body: ReturnType<typeof serializeModel>) => Promise<MutationResult>;
}) {
  const [track, setTrack] = useState<OrgStructureTrack>("functional");
  const [model, setModel] = useState<EditModel>(emptyEditModel);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [saving, setSaving] = useState(false);

  // Синхронизация черновика со снапшотом сервера (первичная загрузка + после save).
  useEffect(() => {
    const next = buildEditModel(data.orgStructure);
    setModel(next);
    setSavedFingerprint(modelFingerprint(next));
  }, [data.orgStructure]);

  const dirty = useMemo(() => modelFingerprint(model) !== savedFingerprint, [model, savedFingerprint]);
  const activeTrack = model[track];
  const unitNoun = unitNounNominative(track);

  const setActiveTrack = (updater: (current: EditTrack) => EditTrack) =>
    setModel((current) => withTrack(current, track, updater(current[track])));

  const addDirection = (name: string) =>
    setActiveTrack((current) => ({
      ...current,
      directions: [...current.directions, { id: newNodeId("dir"), name, units: [] }]
    }));

  const renameDirection = (directionId: string, name: string) =>
    setActiveTrack((current) => ({
      ...current,
      directions: current.directions.map((direction) =>
        direction.id === directionId ? { ...direction, name } : direction
      )
    }));

  const removeDirection = (directionId: string) =>
    setActiveTrack((current) => ({
      directions: current.directions.filter((direction) => direction.id !== directionId),
      placements: current.placements.filter((placement) => placement.directionId !== directionId)
    }));

  const addUnit = (directionId: string, name: string) =>
    setActiveTrack((current) => ({
      ...current,
      directions: current.directions.map((direction) =>
        direction.id === directionId
          ? { ...direction, units: [...direction.units, { id: newNodeId(track === "functional" ? "dep" : "team"), name }] }
          : direction
      )
    }));

  const renameUnit = (directionId: string, unitId: string, name: string) =>
    setActiveTrack((current) => ({
      ...current,
      directions: current.directions.map((direction) =>
        direction.id === directionId
          ? { ...direction, units: direction.units.map((unit) => (unit.id === unitId ? { ...unit, name } : unit)) }
          : direction
      )
    }));

  const removeUnit = (directionId: string, unitId: string) =>
    setActiveTrack((current) => ({
      directions: current.directions.map((direction) =>
        direction.id === directionId
          ? { ...direction, units: direction.units.filter((unit) => unit.id !== unitId) }
          : direction
      ),
      // Расстановки на удалённую единицу становятся неполными → снимаем единицу.
      placements: current.placements.map((placement) =>
        placement.unitId === unitId ? { ...placement, unitId: "" } : placement
      )
    }));

  const setPlacement = (userId: string, next: EditPlacement | null) =>
    setActiveTrack((current) => {
      const others = current.placements.filter((placement) => placement.userId !== userId);
      return { ...current, placements: next ? [...others, next] : others };
    });

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave(serializeModel(model));
    setSaving(false);
    if (result.ok) {
      toast.success("Оргструктура сохранена");
    } else {
      toast.error(orgErr(result.code, result.message));
    }
  };

  const incompleteCount = activeTrack.placements.filter(
    (placement) => (placement.directionId || placement.unitId) && !isPlacementComplete(placement, activeTrack)
  ).length;

  return (
    <div className="flex flex-col gap-4" data-testid="org-structure-editor">
      {/* Переключатель трека + сохранение */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] p-0.5" role="tablist" aria-label="Трек оргструктуры">
          {(["functional", "project"] as const).map((value) => {
            const active = value === track;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`org-structure-track-${value}`}
                onClick={() => setTrack(value)}
                className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium transition-colors ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted-strong)] hover:text-[var(--text-strong)]"
                }`}
              >
                {TRACK_LABEL[value]}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <span data-testid="org-structure-dirty" className="text-[length:var(--text-xs)] text-[var(--muted)]">
              Есть несохранённые изменения
            </span>
          ) : null}
          {canManage ? (
            <Button
              variant="default"
              size="sm"
              data-testid="org-structure-save"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
              title={dirty ? "Сохранить оргструктуру" : "Изменений нет"}
            >
              <Save className="size-3.5" aria-hidden />
              Сохранить
            </Button>
          ) : null}
        </div>
      </div>

      {!canManage ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          Режим просмотра: для изменения оргструктуры нужно право tenant.org_structure.manage.
        </p>
      ) : null}

      {/* Дерево активного трека */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
            Дерево · {TRACK_LABEL[track]}
          </h2>
          {canManage ? (
            <NameDialog
              title="Новое направление"
              submitLabel="Добавить"
              trigger={
                <Button variant="outline" size="sm" data-testid="org-add-direction">
                  <Plus className="size-3.5" aria-hidden />
                  Направление
                </Button>
              }
              onCommit={(name) => addDirection(name)}
            />
          ) : null}
        </div>

        {activeTrack.directions.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)] shadow-[var(--shadow-card)]">
            Направлений пока нет. {canManage ? "Добавьте направление, затем отделы/команды." : "Обратитесь к администратору."}
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="org-directions">
            {activeTrack.directions.map((direction) => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                track={track}
                canManage={canManage}
                onRename={(name) => renameDirection(direction.id, name)}
                onRemove={() => removeDirection(direction.id)}
                onAddUnit={(name) => addUnit(direction.id, name)}
                onRenameUnit={(unitId, name) => renameUnit(direction.id, unitId, name)}
                onRemoveUnit={(unitId) => removeUnit(direction.id, unitId)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Расстановка людей */}
      <PlacementsEditor
        track={track}
        activeTrack={activeTrack}
        users={data.users}
        positions={data.positions}
        canManage={canManage}
        incompleteCount={incompleteCount}
        unitNoun={unitNoun}
        onSetPlacement={setPlacement}
      />
    </div>
  );
}

function DirectionCard({
  direction,
  track,
  canManage,
  onRename,
  onRemove,
  onAddUnit,
  onRenameUnit,
  onRemoveUnit
}: {
  direction: EditDirection;
  track: OrgStructureTrack;
  canManage: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onAddUnit: (name: string) => void;
  onRenameUnit: (unitId: string, name: string) => void;
  onRemoveUnit: (unitId: string) => void;
}) {
  const unitNoun = unitNounNominative(track);
  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 shrink-0 text-[var(--muted-strong)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-strong)]">{direction.name}</span>
        {canManage ? (
          <>
            <NameDialog
              title="Переименовать направление"
              submitLabel="Сохранить"
              initialValue={direction.name}
              trigger={
                <Button variant="ghost" size="sm" aria-label="Переименовать направление">
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              }
              onCommit={onRename}
            />
            <ConfirmDialog
              title="Удалить направление?"
              description={`Направление «${direction.name}» и его ${unitNoun}ы будут убраны из черновика. Изменение применится после сохранения.`}
              confirmLabel="Удалить"
              onConfirm={onRemove}
            >
              <Button variant="ghost" size="sm" aria-label="Удалить направление">
                <Trash2 className="size-3.5 text-[var(--danger)]" aria-hidden />
              </Button>
            </ConfirmDialog>
          </>
        ) : null}
      </div>

      <div className="mt-2 pl-6">
        {direction.units.length === 0 ? (
          <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
            {capitalize(unitNounNominative(track))}ов пока нет.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {direction.units.map((unit) => (
              <li key={unit.id} className="flex items-center gap-2 border-l border-[var(--border-subtle)] pl-2">
                <span className="min-w-0 flex-1 truncate text-[length:var(--text-sm)] text-[var(--text)]">{unit.name}</span>
                {canManage ? (
                  <>
                    <NameDialog
                      title={`Переименовать ${unitNounAccusative(track)}`}
                      submitLabel="Сохранить"
                      initialValue={unit.name}
                      trigger={
                        <Button variant="ghost" size="sm" aria-label={`Переименовать ${unitNounAccusative(track)}`}>
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      }
                      onCommit={(name) => onRenameUnit(unit.id, name)}
                    />
                    <ConfirmDialog
                      title={`Удалить ${unitNounAccusative(track)}?`}
                      description={`«${unit.name}» будет убран(а) из черновика. Расстановки на этот узел станут неполными.`}
                      confirmLabel="Удалить"
                      onConfirm={() => onRemoveUnit(unit.id)}
                    >
                      <Button variant="ghost" size="sm" aria-label={`Удалить ${unitNounAccusative(track)}`}>
                        <Trash2 className="size-3.5 text-[var(--danger)]" aria-hidden />
                      </Button>
                    </ConfirmDialog>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <NameDialog
            title={`Новый ${unitNoun}`}
            submitLabel="Добавить"
            trigger={
              <Button variant="ghost" size="sm" className="mt-1" data-testid={`org-add-unit-${direction.id}`}>
                <Plus className="size-3.5" aria-hidden />
                {capitalize(unitNoun)}
              </Button>
            }
            onCommit={onAddUnit}
          />
        ) : null}
      </div>
    </li>
  );
}

function PlacementsEditor({
  track,
  activeTrack,
  users,
  positions,
  canManage,
  incompleteCount,
  unitNoun,
  onSetPlacement
}: {
  track: OrgStructureTrack;
  activeTrack: EditTrack;
  users: OrgStructureData["users"];
  positions: OrgStructureData["positions"];
  canManage: boolean;
  incompleteCount: number;
  unitNoun: string;
  onSetPlacement: (userId: string, next: EditPlacement | null) => void;
}) {
  const placementByUser = useMemo(() => {
    const map = new Map<string, EditPlacement>();
    for (const placement of activeTrack.placements) map.set(placement.userId, placement);
    return map;
  }, [activeTrack.placements]);

  const unitsForDirection = (directionId: string) =>
    activeTrack.directions.find((direction) => direction.id === directionId)?.units ?? [];

  return (
    <section className="flex flex-col gap-2" data-testid="org-placements">
      <h2 className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">
        Расстановка · {TRACK_LABEL[track]}
      </h2>
      {users.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">
          Справочник сотрудников недоступен (нет права чтения пользователей) — расстановку можно вести на странице «Пользователи».
        </p>
      ) : (
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Сотрудник</th>
                <th className="px-3 py-2 font-semibold">Направление</th>
                <th className="px-3 py-2 font-semibold">{capitalize(unitNoun)}</th>
                <th className="px-3 py-2 font-semibold">Должность</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const placement = placementByUser.get(user.id);
                const directionId = placement?.directionId ?? "";
                const unitId = placement?.unitId ?? "";
                const positionId = placement?.positionId ?? user.positionId ?? "";

                const update = (patch: Partial<EditPlacement>) => {
                  const nextDirectionId = patch.directionId ?? directionId;
                  if (!nextDirectionId) {
                    onSetPlacement(user.id, null);
                    return;
                  }
                  // Смена направления сбрасывает единицу (она принадлежит другому направлению).
                  const nextUnitId = "directionId" in patch ? "" : (patch.unitId ?? unitId);
                  onSetPlacement(user.id, {
                    userId: user.id,
                    directionId: nextDirectionId,
                    unitId: nextUnitId,
                    positionId: patch.positionId ?? positionId
                  });
                };

                return (
                  <tr key={user.id} className="org-structure-placement-row v4-row border-b border-[var(--border-subtle)] last:border-0" data-testid={`org-placement-row-${user.id}`}>
                    <td className="px-3 py-2 font-medium text-[var(--text-strong)]">{user.name}</td>
                    <td className="px-3 py-2">
                      <select
                        className={selCls}
                        value={directionId}
                        disabled={!canManage}
                        aria-label={`Направление сотрудника ${user.name}`}
                        onChange={(event) => update({ directionId: event.target.value })}
                      >
                        <option value="">— не задано —</option>
                        {activeTrack.directions.map((direction) => (
                          <option key={direction.id} value={direction.id}>{direction.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={selCls}
                        value={unitId}
                        disabled={!canManage || !directionId}
                        aria-label={`${unitNoun} сотрудника ${user.name}`}
                        onChange={(event) => update({ unitId: event.target.value })}
                      >
                        <option value="">— не задано —</option>
                        {unitsForDirection(directionId).map((unit) => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={selCls}
                        value={positionId}
                        disabled={!canManage || !directionId}
                        aria-label={`Должность сотрудника ${user.name}`}
                        onChange={(event) => update({ positionId: event.target.value })}
                      >
                        <option value="">— не задано —</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>{position.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {incompleteCount > 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--warning-text,var(--muted-strong))]" data-testid="org-placements-incomplete">
          {incompleteCount} расстановок неполные (нет {unitNoun}а или должности) — они не сохранятся, пока не заполните все поля.
        </p>
      ) : null}
    </section>
  );
}

// Диалог ввода имени узла: валидирует через checkNodeName, коммитит в черновик.
function NameDialog({
  title,
  submitLabel,
  trigger,
  initialValue = "",
  onCommit
}: {
  title: string;
  submitLabel: string;
  trigger: React.ReactNode;
  initialValue?: string;
  onCommit: (name: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const check = checkNodeName(value);

  return (
    <FormDialog
      title={title}
      submitLabel={submitLabel}
      trigger={trigger}
      submitDisabled={!check.ok}
      contentClassName="max-w-[440px]"
      onSubmit={async () => {
        const result = checkNodeName(value);
        if (!result.ok) return result.reason;
        onCommit(result.value);
        return null;
      }}
      onSuccess={() => setValue(initialValue)}
      onClose={() => setValue(initialValue)}
    >
      <label className={labelCls}>
        Название
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="например, Разработка"
          maxLength={160}
          data-testid="org-name-input"
        />
      </label>
    </FormDialog>
  );
}
