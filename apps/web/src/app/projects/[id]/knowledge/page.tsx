import type { Metadata } from "next";

import { PlanningRuntimeProvider } from "@/delivery/lib/planning-runtime";
import { ProjectKnowledge } from "@/delivery/knowledge/knowledge-surface";

// Прод-route «База знаний»: документы с версионированием, журнал решений и
// поручения из /api/workspace/projects/:id/knowledge/* (knowledgeRoutes).
// PlanningRuntimeProvider live — для живой шапки проекта (useProjectBase).
export const metadata: Metadata = { title: "База знаний проекта — KISS PM" };

export default async function ProjectKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanningRuntimeProvider live>
      <ProjectKnowledge projectId={id} />
    </PlanningRuntimeProvider>
  );
}
