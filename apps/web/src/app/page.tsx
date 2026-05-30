import { redirect } from "next/navigation";

import { pathForScreenId, DEFAULT_RUNTIME_SCREEN_ID } from "@/shell/navigation-registry";

export default function HomePage() {
  redirect(pathForScreenId(DEFAULT_RUNTIME_SCREEN_ID) ?? "/dashboard");
}
