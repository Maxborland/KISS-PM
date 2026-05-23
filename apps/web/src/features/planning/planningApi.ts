import { createPlanningApiClient } from "@kiss-pm/planning-client";

const apiOrigin = process.env.NEXT_PUBLIC_KISS_PM_API_ORIGIN ?? "";

export const planningApi = createPlanningApiClient({
  apiOrigin,
  credentials: "same-origin"
});
