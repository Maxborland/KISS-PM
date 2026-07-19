import { NextResponse, type NextRequest } from "next/server";

// Публичные роуты (доступны без сессии). Группа (auth) в URL не участвует.
const PUBLIC_PREFIXES = ["/login", "/register", "/password-reset"];
const SESSION_COOKIE = "kiss_pm_session";

/**
 * Защита роутов на уровне приложения (Next 16 proxy-конвенция; поглотила прежний
 * middleware.ts — вместе они не работают, FPE-ENV-001). Проверяем лишь НАЛИЧИЕ
 * session-cookie (не валидность — её проверяет API, отдавая 401; это UX-гейт,
 * чтобы анонимы не утыкались в пустые экраны).
 *
 * ВАЖНО: не редиректим авторизованного с /login|/register в /dashboard —
 * протухшая cookie заперла бы пользователя без доступа к форме входа.
 */
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = req.cookies.has(SESSION_COOKIE);

  // Корень «/» — не самостоятельная страница: на домашний экран рабочей
  // области «Мои задачи» (согласовано с клиентским фолбэком app/page.tsx,
  // который ловит тот же кейс при протухшей cookie) или на вход.
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = hasSession ? "/my-work" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Аноним на защищённом роуте → форма входа с возвратным путём (?from=),
  // login-surface вернёт пользователя обратно после успешного входа.
  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Всё, кроме API (сам отдаёт 401), Next-внутренностей и файлов со статикой.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"]
};
