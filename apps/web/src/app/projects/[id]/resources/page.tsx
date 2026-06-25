"use client";

import { use } from "react";

import { RuntimeScreenView } from "@/views/screens/runtime-screen-view";

export default function ProjectResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RuntimeScreenView id="13-project-resources" entityId={id} />;
}
