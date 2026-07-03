import type { TenantUser } from "@kiss-pm/domain";
import type { Context } from "hono";

type WithActorDeps = {
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
};

/**
 * Combinator аутентификации: резолвит актора из сессии, короткозамыкает 401 если его нет, и передаёт в
 * handler уже аутентифицированного актора. Делает «нельзя забыть 401» СТРУКТУРНЫМ для нового роута —
 * вместо ~222 копий inline-проверки `const actor = ...; if (!actor) return 401`.
 *
 * Резолвит ТОЛЬКО актора (не профиль): профиль/capability-проверки хендлер делает сам и лениво, чтобы не
 * менять порядок относительно 501/валидации (некоторые роуты fail-closed на persistence ДО профиля).
 * Opt-in per-route (НЕ глобальный middleware): без второго session-lookup на hot path и без риска
 * намеренно-публичным роутам (health/auth). Существующие роуты мигрируются инкрементально.
 */
export function withActor(
  deps: WithActorDeps,
  handler: (context: Context, actor: TenantUser) => Response | Promise<Response>
): (context: Context) => Promise<Response> {
  return async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    return handler(context, actor);
  };
}
