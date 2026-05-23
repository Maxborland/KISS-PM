export const planKeys = {
  all: ["plan"] as const,
  project: (projectId: string) => ["plan", projectId] as const
};
