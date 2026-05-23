"use client";

import { ResourceMatrixCell } from "./ResourceMatrixCell";
import { resourceMatrixGridTemplateColumns } from "./resourceMatrixLayout";
import type { ResourceMatrixGroup, ResourceMatrixRow } from "./resourceMatrixTypes";

export function ResourceMatrixRowGroup(props: {
  group: ResourceMatrixGroup;
  onActivate: (input: { resourceId: string; date: string }) => void;
  onHover: (input: { resourceId: string; date: string } | null) => void;
}) {
  const gridTemplateColumns = resourceMatrixGridTemplateColumns(
    props.group.positionDays.length
  );

  return (
    <div
      className="planning-resource-matrix__group"
      data-testid={`resource-matrix-group-${props.group.position.id}`}
    >
      <div
        className="planning-resource-matrix__row is-position-group"
        style={{ gridTemplateColumns }}
      >
        <div className="planning-resource-matrix__sticky-col">
          {props.group.position.name} · {props.group.rows.length}
        </div>
        {props.group.positionDays.map((cell) => (
          <ResourceMatrixCell
            key={`group-${props.group.position.id}-${cell.date}`}
            cell={cell}
            resourceId={null}
            onActivate={props.onActivate}
            onHover={props.onHover}
          />
        ))}
      </div>
      {props.group.rows.map((row) => (
        <UserRow
          key={`user-${row.user.id}`}
          row={row}
          gridTemplateColumns={gridTemplateColumns}
          onActivate={props.onActivate}
          onHover={props.onHover}
        />
      ))}
    </div>
  );
}

function UserRow(props: {
  row: ResourceMatrixRow;
  gridTemplateColumns: string;
  onActivate: (input: { resourceId: string; date: string }) => void;
  onHover: (input: { resourceId: string; date: string } | null) => void;
}) {
  return (
    <div
      className="planning-resource-matrix__row"
      style={{ gridTemplateColumns: props.gridTemplateColumns }}
      data-testid={`resource-matrix-row-${props.row.user.id}`}
    >
      <div className="planning-resource-matrix__sticky-col">{props.row.user.name}</div>
      {props.row.days.map((cell) => (
        <ResourceMatrixCell
          key={`${props.row.user.id}-${cell.date}`}
          cell={cell}
          resourceId={props.row.user.id}
          onActivate={props.onActivate}
          onHover={props.onHover}
        />
      ))}
    </div>
  );
}
