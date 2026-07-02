import { describe, expect, it } from "vitest";
import { ORBIT_CONFIGS } from "./orbitData";
import {
  COLLISION_GAP,
  PROJECTED_COLLISION_GAP,
  orbitPointAt,
  projectOrbitPoint,
  visualRadiusFor,
} from "./orbitSimulation";

describe("portfolio orbit data", () => {
  it("keeps inner planets smaller than outer planets", () => {
    const config = ORBIT_CONFIGS.holding;
    const averageSizeByRing = config.rings.map((ring) => {
      const nodes = config.nodes.filter((node) => node.ring === ring.index);
      const total = nodes.reduce((sum, node) => sum + node.size, 0);
      return total / nodes.length;
    });

    averageSizeByRing.slice(1).forEach((size, index) => {
      expect(size).toBeGreaterThan(averageSizeByRing[index]);
    });
  });

  it("does not place planets in intersecting start positions or default camera projection", () => {
    const config = ORBIT_CONFIGS.holding;
    const radiusByRing = new Map(config.rings.map((ring) => [ring.index, ring.radius]));
    const placed = config.nodes.map((node) => {
      const radius = radiusByRing.get(node.ring) ?? 1;
      const visualRadius = visualRadiusFor(node);
      return { id: node.id, ...projectOrbitPoint(orbitPointAt(radius, node.angle), visualRadius) };
    });

    placed.forEach((node, index) => {
      placed.slice(index + 1).forEach((otherNode) => {
        const dx = node.x - otherNode.x;
        const dz = node.z - otherNode.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minimumDistance = node.visualRadius + otherNode.visualRadius + COLLISION_GAP;
        const screenDx = node.screenX - otherNode.screenX;
        const screenDy = node.screenY - otherNode.screenY;
        const screenDistance = Math.sqrt(screenDx * screenDx + screenDy * screenDy);
        const minimumScreenDistance =
          node.screenRadius + otherNode.screenRadius + PROJECTED_COLLISION_GAP;

        expect(distance, `${node.id} intersects ${otherNode.id}`).toBeGreaterThanOrEqual(
          minimumDistance,
        );
        expect(
          screenDistance,
          `${node.id} visually overlaps ${otherNode.id}`,
        ).toBeGreaterThanOrEqual(minimumScreenDistance);
      });
    });
  });

  it("keeps planet spacing stable during orbit motion", () => {
    const config = ORBIT_CONFIGS.holding;
    const radiusByRing = new Map(config.rings.map((ring) => [ring.index, ring.radius]));
    const sampleTimes = [0, 15, 30, 45, 60];

    sampleTimes.forEach((elapsed) => {
      const placed = config.nodes.map((node) => {
        const radius = radiusByRing.get(node.ring) ?? 1;
        const angle = node.angle + elapsed * node.speed;
        const point = orbitPointAt(radius, angle);
        return {
          id: node.id,
          x: point.x,
          z: point.z,
          visualRadius: visualRadiusFor(node),
        };
      });

      placed.forEach((node, index) => {
        placed.slice(index + 1).forEach((otherNode) => {
          const dx = node.x - otherNode.x;
          const dz = node.z - otherNode.z;
          const distance = Math.sqrt(dx * dx + dz * dz);
          const minimumDistance = node.visualRadius + otherNode.visualRadius + COLLISION_GAP;

          expect(
            distance,
            `${node.id} intersects ${otherNode.id} at ${elapsed}s`,
          ).toBeGreaterThanOrEqual(minimumDistance);
        });
      });
    });
  });
});
