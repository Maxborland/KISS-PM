"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-canvas">
      <div className="app-canvas__panel app-content">
        <div className="page-intro">
          <h1 className="page-intro__title">Ошибка</h1>
          <p className="page-intro__lead">{error.message}</p>
          <button type="button" className="btn btn--primary" onClick={reset}>
            Повторить
          </button>
        </div>
      </div>
    </main>
  );
}
