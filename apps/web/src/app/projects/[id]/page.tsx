"use client";

import { use } from "react";

import { RuntimeScreenView } from "@/views/screens/runtime-screen-view";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <RuntimeScreenView id="07b-project-detail" entityId={id} />;
}
