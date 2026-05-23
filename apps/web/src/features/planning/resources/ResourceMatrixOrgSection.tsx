"use client";

import { ResourceMatrixRowGroup } from "./ResourceMatrixRowGroup";
import { ResourceMatrixCell } from "./ResourceMatrixCell";
import type { ResourceMatrixDayLoad, ResourceMatrixOrgDirectionGroup } from "./resourceMatrixTypes";

export function ResourceMatrixOrgSection(props: {
  orgGroups: ResourceMatrixOrgDirectionGroup[];
  gridTemplateColumns: string;
  onActivate: (input: { resourceId: string; date: string }) => void;
  onHover: (input: { resourceId: string; date: string } | null) => void;
}) {
  return (
    <>
      {props.orgGroups.map((directionGroup) => (
        <div
          key={directionGroup.direction.id}
          className="planning-resource-matrix__org-direction"
          data-testid={`resource-matrix-direction-${directionGroup.direction.id}`}
        >
          <AggregateRow
            label={`${directionGroup.direction.name} · направление`}
            className="is-direction-group"
            days={directionGroup.directionDays}
            gridTemplateColumns={props.gridTemplateColumns}
            onActivate={props.onActivate}
            onHover={props.onHover}
          />
          {directionGroup.units.map((unitGroup) => (
            <div
              key={`${directionGroup.direction.id}-${unitGroup.unit.id}`}
              className="planning-resource-matrix__org-unit"
              data-testid={`resource-matrix-unit-${unitGroup.unit.id}`}
            >
              <AggregateRow
                label={`${unitGroup.unit.name}`}
                className="is-unit-group"
                days={unitGroup.unitDays}
                gridTemplateColumns={props.gridTemplateColumns}
                onActivate={props.onActivate}
                onHover={props.onHover}
              />
              {unitGroup.positions.map((positionGroup) => (
                <ResourceMatrixRowGroup
                  key={`${unitGroup.unit.id}-${positionGroup.position.id}`}
                  group={positionGroup}
                  onActivate={props.onActivate}
                  onHover={props.onHover}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function AggregateRow(props: {
  label: string;
  className: string;
  days: ResourceMatrixDayLoad[];
  gridTemplateColumns: string;
  onActivate: (input: { resourceId: string; date: string }) => void;
  onHover: (input: { resourceId: string; date: string } | null) => void;
}) {
  return (
    <div
      className={`planning-resource-matrix__row ${props.className}`}
      style={{ gridTemplateColumns: props.gridTemplateColumns }}
    >
      <div className="planning-resource-matrix__sticky-col">{props.label}</div>
      {props.days.map((cell) => (
        <ResourceMatrixCell
          key={`${props.label}-${cell.date}`}
          cell={cell}
          resourceId={null}
          onActivate={props.onActivate}
          onHover={props.onHover}
        />
      ))}
    </div>
  );
}

export {
  RESOURCE_MATRIX_DAY_COLUMN_WIDTH as DAY_COLUMN_WIDTH,
  RESOURCE_MATRIX_NAME_COLUMN_WIDTH as NAME_COLUMN_WIDTH
} from "./resourceMatrixLayout";
