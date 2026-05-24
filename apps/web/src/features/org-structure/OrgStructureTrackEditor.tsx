"use client";

import "../planning/planning.css";
import { removeOrgNode, reparentOrgUnit } from "./orgStructureDraft";
import {
  type OrgStructurePlacementInput,
  type OrgStructureTrack,
  type TenantOrgStructureSnapshot
} from "./useOrgStructure";

export type OrgStructureWorkspaceUser = { id: string; name: string; positionId: string | null };
export type OrgStructureWorkspacePosition = { id: string; name: string };
export function OrgStructureTrackEditor(props: {
  track: OrgStructureTrack;
  snapshot: TenantOrgStructureSnapshot["functional"];
  canManage: boolean;
  users: OrgStructureWorkspaceUser[];
  positions: OrgStructureWorkspacePosition[];
  onChange: (next: TenantOrgStructureSnapshot["functional"]) => void;
}) {
  const directions = props.snapshot.nodes
    .filter((node) => node.nodeType === "direction")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"));
  const childType = props.track === "functional" ? "department" : "team";
  const childLabel = props.track === "functional" ? "Отдел" : "Команда";

  const addDirection = () => {
    const id = crypto.randomUUID();
    props.onChange({
      ...props.snapshot,
      nodes: [
        ...props.snapshot.nodes,
        {
          id,
          tenantId: "",
          track: props.track,
          nodeType: "direction",
          name: "Новое направление",
          parentId: null,
          sortOrder: directions.length
        }
      ]
    });
  };

  return (
    <section className="org-structure-track" data-testid={`org-structure-track-${props.track}`}>
      {props.canManage ? (
        <button className="secondary-button" type="button" onClick={addDirection}>
          Добавить направление
        </button>
      ) : null}

      {directions.length === 0 ? (
        <p className="planning-pane__muted" data-testid="org-structure-empty">
          Нет направлений. Добавьте первое направление для функциональной или проектной структуры.
        </p>
      ) : null}

      {directions.map((direction) => {
        const children = props.snapshot.nodes
          .filter((node) => node.parentId === direction.id)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"));
        return (
          <article key={direction.id} className="org-structure-direction">
            <header className="org-structure-direction__header">
              <input
                className="org-structure-input"
                value={direction.name}
                readOnly={!props.canManage}
                onChange={(event) => {
                  props.onChange({
                    ...props.snapshot,
                    nodes: props.snapshot.nodes.map((node) =>
                      node.id === direction.id ? { ...node, name: event.target.value } : node
                    )
                  });
                }}
              />
              {props.canManage ? (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      const id = crypto.randomUUID();
                      props.onChange({
                        ...props.snapshot,
                        nodes: [
                          ...props.snapshot.nodes,
                          {
                            id,
                            tenantId: "",
                            track: props.track,
                            nodeType: childType,
                            name: `Новый ${childLabel.toLowerCase()}`,
                            parentId: direction.id,
                            sortOrder: children.length
                          }
                        ]
                      });
                    }}
                  >
                    + {childLabel}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    data-testid={`org-delete-direction-${direction.id}`}
                    onClick={() =>
                      props.onChange(removeOrgNode(props.snapshot, direction.id))
                    }
                  >
                    Удалить направление
                  </button>
                </>
              ) : null}
            </header>
            <ul className="org-structure-units">
              {children.map((unit) => (
                <li key={unit.id} className="org-structure-unit-row">
                  <input
                    className="org-structure-input"
                    value={unit.name}
                    readOnly={!props.canManage}
                    onChange={(event) => {
                      props.onChange({
                        ...props.snapshot,
                        nodes: props.snapshot.nodes.map((node) =>
                          node.id === unit.id ? { ...node, name: event.target.value } : node
                        )
                      });
                    }}
                  />
                  {props.canManage ? (
                    <>
                      <select
                        className="org-structure-unit-reparent"
                        value={unit.parentId ?? ""}
                        aria-label={`Направление для ${unit.name}`}
                        onChange={(event) =>
                          props.onChange(
                            reparentOrgUnit(props.snapshot, unit.id, event.target.value)
                          )
                        }
                      >
                        {directions.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="secondary-button"
                        data-testid={`org-delete-unit-${unit.id}`}
                        onClick={() =>
                          props.onChange(removeOrgNode(props.snapshot, unit.id))
                        }
                      >
                        Удалить
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        );
      })}

      <h2 className="org-structure-placements__title">Привязка сотрудников</h2>
      <div className="org-structure-placements">
        {props.users.map((user) => {
          const placement = props.snapshot.placements.find((item) => item.userId === user.id);
          return (
            <div key={user.id} className="org-structure-placement-row">
              <span>{user.name}</span>
              <PlacementFields
                track={props.track}
                snapshot={props.snapshot}
                canManage={props.canManage}
                userId={user.id}
                defaultPositionId={user.positionId}
                placement={placement}
                positions={props.positions}
                onChange={(nextPlacement) => {
                  const without = props.snapshot.placements.filter((item) => item.userId !== user.id);
                  props.onChange({
                    ...props.snapshot,
                    placements: nextPlacement
                      ? [
                          ...without,
                          {
                            tenantId: "",
                            userId: nextPlacement.userId,
                            track: props.track,
                            directionId: nextPlacement.directionId,
                            departmentId: nextPlacement.departmentId ?? null,
                            teamId: nextPlacement.teamId ?? null,
                            positionId: nextPlacement.positionId
                          }
                        ]
                      : without
                  });
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlacementFields(props: {
  track: OrgStructureTrack;
  snapshot: TenantOrgStructureSnapshot["functional"];
  canManage: boolean;
  userId: string;
  placement: TenantOrgStructureSnapshot["functional"]["placements"][number] | undefined;
  positions: OrgStructureWorkspacePosition[];
  defaultPositionId: string | null;
  onChange: (placement: OrgStructurePlacementInput | null) => void;
}) {
  const directions = props.snapshot.nodes.filter((node) => node.nodeType === "direction");
  const directionId = props.placement?.directionId ?? "";
  const unitId =
    props.track === "functional"
      ? (props.placement?.departmentId ?? "")
      : (props.placement?.teamId ?? "");
  const positionId =
    props.placement?.positionId ?? props.defaultPositionId ?? props.positions[0]?.id ?? "";
  const units = props.snapshot.nodes.filter(
    (node) =>
      node.parentId === directionId &&
      node.nodeType === (props.track === "functional" ? "department" : "team")
  );

  const update = (patch: Partial<OrgStructurePlacementInput>) => {
    const nextDirectionId = patch.directionId ?? directionId;
    const nextUnitId =
      patch.departmentId !== undefined
        ? (patch.departmentId ?? "")
        : patch.teamId !== undefined
          ? (patch.teamId ?? "")
          : unitId;
    const nextPositionId = patch.positionId ?? positionId;
    if (!nextDirectionId || !nextUnitId || !nextPositionId) {
      props.onChange(null);
      return;
    }
    props.onChange({
      userId: props.userId,
      directionId: nextDirectionId,
      positionId: nextPositionId,
      departmentId: props.track === "functional" ? nextUnitId : null,
      teamId: props.track === "project" ? nextUnitId : null
    });
  };

  return (
    <div className="org-structure-placement-fields">
      <select
        disabled={!props.canManage}
        value={directionId}
        onChange={(event) => update({ directionId: event.target.value, departmentId: null, teamId: null })}
      >
        <option value="">Направление</option>
        {directions.map((direction) => (
          <option key={direction.id} value={direction.id}>
            {direction.name}
          </option>
        ))}
      </select>
      <select
        disabled={!props.canManage || !directionId}
        value={unitId}
        onChange={(event) =>
          update(
            props.track === "functional"
              ? { departmentId: event.target.value, teamId: null }
              : { teamId: event.target.value, departmentId: null }
          )
        }
      >
        <option value="">{props.track === "functional" ? "Отдел" : "Команда"}</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
      <select
        disabled={!props.canManage}
        value={positionId}
        onChange={(event) => update({ positionId: event.target.value })}
      >
        {props.positions.map((position) => (
          <option key={position.id} value={position.id}>
            {position.name}
          </option>
        ))}
      </select>
    </div>
  );
}
