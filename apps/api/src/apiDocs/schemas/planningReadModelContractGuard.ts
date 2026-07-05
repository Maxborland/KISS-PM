import type { PlanningReadModel } from "@kiss-pm/domain";

import { planningSchemas } from "./planning";

// Compile-time гард: OpenAPI-схема PlanningReadModelResponse ↔ доменный тип PlanningReadModel.
// Раньше форма read-model жила в 4 несвязанных источниках правды (домен-тип, возврат createPlanningReadModel,
// planning-client, эта OpenAPI-схема) и синхронилась вручную. Теперь домен — единственный источник, а этот
// файл держит схему честной: добавишь/переименуешь top-level поле read-model без правки схемы (или наоборот)
// → union ключей разойдётся, ExactKeys станет never, и `= true` перестанет компилироваться ЗДЕСЬ.
type ExactKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const __planningReadModelSchemaKeysMatchType: ExactKeys<
  keyof (typeof planningSchemas)["PlanningReadModelResponse"]["properties"],
  keyof PlanningReadModel
> = true;

export const __planningAuthoredSchemaKeysMatchType: ExactKeys<
  keyof (typeof planningSchemas)["PlanningReadModelResponse"]["properties"]["authored"]["properties"],
  keyof PlanningReadModel["authored"]
> = true;
