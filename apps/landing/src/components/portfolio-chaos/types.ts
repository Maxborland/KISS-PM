export type ScaleId = "team" | "office" | "holding";

export interface ScaleState {
  id: ScaleId;
  projects: number;
  title: string;
  role: string;
}

export type OrbitKind =
  | "project"
  | "resource"
  | "signal"
  | "decision"
  | "scenario";

export interface OrbitRingDef {
  index: number;
  radius: number;
  kind: OrbitKind;
  label: string;
}

export interface OrbitNodeDef {
  id: string;
  label: string;
  kind: OrbitKind;
  ring: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  colorTo: string;
  gradient: boolean;
  moonCount: number;
  moonColor: string;
  priority?: "normal" | "quiet" | "hot";
}

export interface OrbitConfig {
  rings: OrbitRingDef[];
  nodes: OrbitNodeDef[];
  mobileNodeLimit: number;
}
