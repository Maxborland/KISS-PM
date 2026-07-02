import type { OrbitNodeDef } from "./types";

export interface OrbitPoint {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedOrbitNode extends OrbitPoint {
  visualRadius: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
}

export const VISUAL_RADIUS_FACTOR = 0.14;
export const COLLISION_GAP = 0.055;
export const PROJECTED_COLLISION_GAP = 0.027;

export const ORBIT_CAMERA = {
  position: { x: 0.2, y: 4.55, z: 7.4 },
  target: { x: 0.45, y: -0.12, z: 0 },
  fov: 43,
} as const;

const CAMERA_FOCAL = 1 / Math.tan((ORBIT_CAMERA.fov * Math.PI) / 360);

function normalize(vector: OrbitPoint): OrbitPoint {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function cross(a: OrbitPoint, b: OrbitPoint): OrbitPoint {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: OrbitPoint, b: OrbitPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

const CAMERA_FORWARD = normalize({
  x: ORBIT_CAMERA.target.x - ORBIT_CAMERA.position.x,
  y: ORBIT_CAMERA.target.y - ORBIT_CAMERA.position.y,
  z: ORBIT_CAMERA.target.z - ORBIT_CAMERA.position.z,
});
const CAMERA_RIGHT = normalize(cross(CAMERA_FORWARD, { x: 0, y: 1, z: 0 }));
const CAMERA_UP = normalize(cross(CAMERA_RIGHT, CAMERA_FORWARD));

export function priorityScaleFor(node: Pick<OrbitNodeDef, "priority">): number {
  if (node.priority === "hot") {
    return 1.08;
  }
  if (node.priority === "quiet") {
    return 0.82;
  }
  return 1;
}

export function visualRadiusFor(node: Pick<OrbitNodeDef, "size" | "priority">): number {
  return node.size * priorityScaleFor(node) * VISUAL_RADIUS_FACTOR;
}

export function orbitPointAt(radius: number, angle: number): OrbitPoint {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle * 2 + radius * 0.25) * 0.05,
    z: Math.sin(angle) * radius,
  };
}

export function projectOrbitPoint(
  point: OrbitPoint,
  visualRadius: number,
): ProjectedOrbitNode {
  const relative = {
    x: point.x - ORBIT_CAMERA.position.x,
    y: point.y - ORBIT_CAMERA.position.y,
    z: point.z - ORBIT_CAMERA.position.z,
  };
  const depth = Math.max(0.001, dot(relative, CAMERA_FORWARD));

  return {
    ...point,
    visualRadius,
    screenX: (dot(relative, CAMERA_RIGHT) / depth) * CAMERA_FOCAL,
    screenY: (dot(relative, CAMERA_UP) / depth) * CAMERA_FOCAL,
    screenRadius: (visualRadius / depth) * CAMERA_FOCAL,
  };
}

export function projectedNodeAt(
  radius: number,
  angle: number,
  visualRadius: number,
): ProjectedOrbitNode {
  return projectOrbitPoint(orbitPointAt(radius, angle), visualRadius);
}

export function areOrbitNodesSeparated(
  candidate: ProjectedOrbitNode,
  placedNodes: ProjectedOrbitNode[],
): boolean {
  return placedNodes.every((placed) => {
    const dx = candidate.x - placed.x;
    const dz = candidate.z - placed.z;
    const minDistance = candidate.visualRadius + placed.visualRadius + COLLISION_GAP;
    const sx = candidate.screenX - placed.screenX;
    const sy = candidate.screenY - placed.screenY;
    const minScreenDistance =
      candidate.screenRadius + placed.screenRadius + PROJECTED_COLLISION_GAP;

    return (
      dx * dx + dz * dz >= minDistance * minDistance &&
      sx * sx + sy * sy >= minScreenDistance * minScreenDistance
    );
  });
}
