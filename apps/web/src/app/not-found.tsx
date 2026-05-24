import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-canvas">
      <div className="app-canvas__panel app-content">
        <div className="page-intro">
          <h1 className="page-intro__title">Страница не найдена</h1>
          <p className="page-intro__lead">Запрошенный маршрут не существует.</p>
          <Link href="/" className="btn btn--primary">
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
