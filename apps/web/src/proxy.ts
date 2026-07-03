import { NextResponse, type NextRequest } from "next/server";

// Публичные роуты (доступны без сессии). Группа (auth) в URL не участвует.
const PUBLIC_PREFIXES = ["/login", "/register", "/password-reset"];

/**
 * Защита роутов на уровне приложения (Next 16 proxy-конвенция): аноним на защищённой
 * странице → /login. Проверяем лишь НАЛИЧИЕ session-cookie (не валидность — её проверяет API,
 * отдавая 401; это только UX-редирект, чтобы анонимы не утыкались в пустые экраны).
 */
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = req.cookies.has("kiss_pm_session");

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Всё, кроме API (сам отдаёт 401), Next-внутренностей и файлов со статикой.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"]
};
