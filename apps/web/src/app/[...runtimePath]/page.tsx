import { notFound } from "next/navigation";

import { RuntimeScreen } from "@/app/runtime-screen";
import { screenIdForPath } from "@/shell/navigation-registry";

export default async function RuntimePathPage({
  params
}: {
  params: Promise<{ runtimePath?: string[] }>;
}) {
  const { runtimePath = [] } = await params;
  const screenId = screenIdForPath(`/${runtimePath.join("/")}`);

  if (!screenId) {
    notFound();
  }

  return <RuntimeScreen screenId={screenId} />;
}

