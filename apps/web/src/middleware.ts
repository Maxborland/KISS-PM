import { NextResponse, type NextRequest } from "next/server";

// Защита роутов рабочей области (BUG-AUTH-02): без сессионной cookie доступ к
// приложению закрыт — редирект на /login с сохранением исходного пути (?from=).
// Проверяем только НАЛИЧИЕ cookie (HttpOnly, читается на сервере); валидность
// токена подтверждает API (401 → клиент вернёт на /login). Это гейт навигации,
// не замена серверной авторизации.
const SESSION_COOKIE = "kiss_pm_session";
const PUBLIC_PATHS = ["/login", "/register", "/password-reset"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // Корень «/» — не самостоятельная страница: ведём в рабочую область или на вход.
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = hasSession ? "/dashboard" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Анонимный запрос защищённого роута → на форму входа с возвратным путём.
  if (!hasSession && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ВАЖНО: не редиректим авторизованного с /login|/register в /dashboard.
  // Наличие cookie ≠ валидная сессия — протухшая cookie заперла бы пользователя
  // без доступа к форме входа. Успешный вход уводит в рабочую область на клиенте
  // (login-surface, useEffect по state==="authenticated").
  return NextResponse.next();
}

export const config = {
  // Исключаем API, служебные ассеты Next и файлы с расширением (favicon и т.п.).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"]
};
