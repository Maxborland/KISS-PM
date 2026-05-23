export function PlanningRemoteBanner(props: { message: string | null; onDismiss: () => void }) {
  if (!props.message) return null;
  return (
    <div className="planning-remote-banner" data-testid="planning-remote-banner" role="status">
      <span>{props.message}</span>
      <button type="button" className="secondary-button" onClick={props.onDismiss}>
        Закрыть
      </button>
    </div>
  );
}
