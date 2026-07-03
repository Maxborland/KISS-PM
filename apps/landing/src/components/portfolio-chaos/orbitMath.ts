import type { OrbitConfig, OrbitNodeDef } from "./types";
import { orbitPointAt, type OrbitPoint } from "./orbitSimulation";

export function ringRadiusFor(config: OrbitConfig, ringIndex: number): number {
  return config.rings.find((ring) => ring.index === ringIndex)?.radius ?? 1;
}

export function pointForNode(config: OrbitConfig, node: OrbitNodeDef): OrbitPoint {
  return pointForNodeAt(config, node, 0);
}

export function pointForNodeAt(config: OrbitConfig, node: OrbitNodeDef, elapsed: number): OrbitPoint {
  const radius = ringRadiusFor(config, node.ring);
  const angle = node.angle + elapsed * node.speed;
  return orbitPointAt(radius, angle);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
