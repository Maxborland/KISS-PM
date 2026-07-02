interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
  return (
    <div className="zoomControls" aria-label="Управление приближением">
      <button type="button" aria-label="Приблизить сцену" onClick={onZoomIn}>
        +
      </button>
      <button type="button" aria-label="Отдалить сцену" onClick={onZoomOut}>
        −
      </button>
    </div>
  );
}
