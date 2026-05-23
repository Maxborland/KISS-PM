export function ScenariosCompareTable(props: {
  proposals: Array<Record<string, unknown>>;
}) {
  if (props.proposals.length === 0) return null;

  return (
    <table className="planning-scenario-compare" data-testid="planning-scenario-compare">
      <thead>
        <tr>
          <th>Профиль</th>
          <th>Сдвиг срока, дн</th>
          <th>Перегрузки</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
        {props.proposals.map((proposal) => {
          const metrics = (proposal.metrics ?? proposal.summary) as Record<string, unknown> | undefined;
          const shiftDays = Number(metrics?.scheduleShiftDays ?? metrics?.deadlineShiftDays ?? 0);
          const overloadCount = Number(metrics?.overloadCount ?? metrics?.overloads ?? 0);
          return (
            <tr key={String(proposal.id)}>
              <td>{String(proposal.profile ?? proposal.id)}</td>
              <td>{Number.isFinite(shiftDays) ? shiftDays : "—"}</td>
              <td>{Number.isFinite(overloadCount) ? overloadCount : "—"}</td>
              <td>{String(proposal.recommendedAction ?? "—")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
