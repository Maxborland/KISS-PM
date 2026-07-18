import { describe, expect, it } from "vitest";

import { feasibilityEmptyCopy, kanbanInteractionHint } from "./deal-permission-copy";

describe("permission-aware CRM copy", () => {
  it("не предлагает reader недоступные drag и проверку", () => {
    expect(kanbanInteractionHint(false)).toBe("Канбан доступен только для просмотра; перенос выполняет пользователь с правом управления сделками.");
    expect(feasibilityEmptyCopy(false, "Недостаточно прав для управления сделками")).toBe("Проверка осуществимости ещё не запускалась. Её может запустить пользователь с правом управления сделками. Недостаточно прав для управления сделками.");
  });
});
