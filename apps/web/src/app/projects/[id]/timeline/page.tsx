"use client";

import { use } from "react";

import { RuntimeScreenView } from "@/views/screens/runtime-screen-view";

export default function ProjectTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RuntimeScreenView id="12-project-gantt" entityId={id} />;
}
