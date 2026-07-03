import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitConfig, OrbitKind } from "./types";

interface OrbitRings3DProps {
  config: OrbitConfig;
  visibleRingCount: number;
  reducedMotion: boolean;
}

const RING_COLORS: Record<OrbitKind, string> = {
  project: "#2563eb",
  resource: "#0ea5e9",
  signal: "#f59e0b",
  decision: "#8b5cf6",
  scenario: "#64748b",
};
const INITIAL_VISIBLE_RINGS = 6;

function OrbitRing3D({
  color,
  index,
  radius,
  reducedMotion,
}: {
  color: string;
  index: number;
  radius: number;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startRef = useRef<number | null>(null);
  const targetOpacity = index <= 5 ? 0.2 : 0.13;
  const initiallyVisible = index <= INITIAL_VISIBLE_RINGS;

  useEffect(() => {
    startRef.current = null;
  }, [index]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) {
      return;
    }
    if (reducedMotion) {
      mesh.scale.setScalar(1);
      material.opacity = targetOpacity;
      return;
    }
    const elapsed = clock.getElapsedTime();
    if (initiallyVisible) {
      mesh.scale.setScalar(1);
      material.opacity = targetOpacity;
      return;
    }
    const start: number = startRef.current ?? elapsed;
    if (startRef.current === null) {
      startRef.current = start;
    }
    const progress = Math.min(1, (elapsed - start) / 1.1);
    const eased = 1 - Math.pow(1 - progress, 3);
    mesh.scale.setScalar(0.965 + eased * 0.035);
    material.opacity = targetOpacity * eased;
  });

  const geometryArgs = useMemo(() => [radius, 0.0042, 8, 224] as const, [radius]);

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={geometryArgs} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={targetOpacity}
        depthWrite={false}
      />
    </mesh>
  );
}

export function OrbitRings3D({ config, visibleRingCount, reducedMotion }: OrbitRings3DProps) {
  return (
    <group>
      {config.rings
        .filter((ring) => ring.index <= visibleRingCount)
        .map((ring) => (
          <OrbitRing3D
            key={ring.index}
            color={RING_COLORS[ring.kind]}
            index={ring.index}
            radius={ring.radius}
            reducedMotion={reducedMotion}
          />
        ))}
    </group>
  );
}
