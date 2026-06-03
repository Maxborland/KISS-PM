import { notFound } from "next/navigation";

import { projectIdForRuntimePath, screenIdForPath } from "@/shell/navigation-registry";
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
  const runtimePathname = `/${runtimePath.join("/")}`;
  const screenId = screenIdForPath(runtimePathname);

  if (!screenId) {
    notFound();
  }

  return (
    <RuntimeScreen
      screenId={screenId}
      projectId={projectIdForRuntimePath(runtimePathname) ?? undefined}
      initialTaskId={firstSearchParamValue(resolvedSearchParams?.taskId)}
    />
  );
}

function firstSearchParamValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim().length > 0 ? first : undefined;
}
