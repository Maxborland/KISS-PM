import { notFound } from "next/navigation";

import { screenIdForPath } from "@/shell/navigation-registry";
import { RuntimeScreen } from "@/shell/runtime-screen";

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

