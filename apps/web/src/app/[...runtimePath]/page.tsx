import { notFound } from "next/navigation";

import { screenIdForPath } from "@/shell/navigation-registry";
import { RuntimeScreen } from "@/shell/runtime-screen";

export default async function RuntimePathPage({
  params,
  searchParams
}: {
  params: Promise<{ runtimePath?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { runtimePath = [] } = await params;
  const resolvedSearchParams = await searchParams;
  const screenId = screenIdForPath(`/${runtimePath.join("/")}`);

  if (!screenId) {
    notFound();
  }

  return (
    <RuntimeScreen
      screenId={screenId}
      initialTaskId={firstSearchParamValue(resolvedSearchParams?.taskId)}
    />
  );
}

function firstSearchParamValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim().length > 0 ? first : undefined;
}
