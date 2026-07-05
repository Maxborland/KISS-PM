import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { pointForNodeAt } from "./orbitMath";
import type { OrbitConfig, OrbitNodeDef } from "./types";

interface OrbitNodeLabels3DProps {
  config: OrbitConfig;
  nodes: OrbitNodeDef[];
  mobile: boolean;
  reducedMotion: boolean;
}

interface OrbitLabelProps {
  config: OrbitConfig;
  node: OrbitNodeDef;
  distanceFactor: number;
  reducedMotion: boolean;
}

function OrbitLabel({ config, node, distanceFactor, reducedMotion }: OrbitLabelProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const point = pointForNodeAt(config, node, reducedMotion ? 0 : clock.getElapsedTime());
    groupRef.current?.position.set(point.x, point.y + 0.08, point.z);
  });

  const initialPoint = pointForNodeAt(config, node, 0);

  return (
    <group ref={groupRef} position={[initialPoint.x, initialPoint.y + 0.08, initialPoint.z]}>
      <Html center occlude={false} distanceFactor={distanceFactor} zIndexRange={[10, 0]}>
        <span
          className={`orbitChip orbitChip--${node.kind}`}
          data-priority={node.priority ?? "normal"}
          aria-hidden="true"
        >
          {node.label}
        </span>
      </Html>
    </group>
  );
}

export function OrbitNodeLabels3D({ config, nodes, mobile, reducedMotion }: OrbitNodeLabels3DProps) {
  const distanceFactor = mobile ? 4.4 : 3.25;
  const limits =
    nodes.length > 45
      ? { project: 2, resource: 2, signal: 3, decision: 2, scenario: 1 }
      : nodes.length > 24
        ? { project: 5, resource: 3, signal: 3, decision: 2, scenario: 1 }
        : { project: 16, resource: 8, signal: 8, decision: 8, scenario: 8 };
  const counters = { project: 0, resource: 0, signal: 0, decision: 0, scenario: 0 };
  const labelledNodes = nodes.filter((node, index) => {
    if (nodes.length > 45 && node.kind === "project" && index % 4 !== 0) {
      return false;
    }
    if (nodes.length > 45 && node.kind === "resource" && index % 2 !== 0) {
      return false;
    }
    if (nodes.length > 24 && node.kind === "project" && index % 2 !== 0) {
      return false;
    }

    counters[node.kind] += 1;
    return counters[node.kind] <= limits[node.kind];
  });

  return (
    <>
      {labelledNodes.map((node) => {
        return (
          <OrbitLabel
            key={node.id}
            config={config}
            node={node}
            distanceFactor={distanceFactor}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </>
  );
}
