import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { pointForNodeAt } from "./orbitMath";
import type { OrbitConfig, OrbitNodeDef } from "./types";

interface InstancedOrbitNodes3DProps {
  config: OrbitConfig;
  nodes: OrbitNodeDef[];
  reducedMotion: boolean;
}

interface PlanetSystemProps {
  config: OrbitConfig;
  node: OrbitNodeDef;
  nodeIndex: number;
  reducedMotion: boolean;
}

const INITIAL_VISIBLE_RINGS = 6;

const planetVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const planetFragmentShader = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uSeed;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    float latitude = vPosition.y * 0.5 + 0.5;
    float band = sin((vPosition.x + vPosition.z) * 8.0 + uSeed) * 0.08;
    float mixValue = clamp(latitude + band, 0.0, 1.0);
    float light = 0.68 + max(dot(normalize(vNormal), normalize(vec3(-0.25, 0.7, 0.65))), 0.0) * 0.32;
    vec3 color = mix(uColorA, uColorB, mixValue) * light;
    gl_FragColor = vec4(color, 0.96);
  }
`;

function scaleFor(node: OrbitNodeDef): number {
  const priorityScale = node.priority === "hot" ? 1.08 : node.priority === "quiet" ? 0.82 : 1;
  return node.size * priorityScale * 0.14;
}

function revealValue(introElapsed: number, node: OrbitNodeDef, nodeIndex: number): number {
  const delay = (nodeIndex % 9) * 0.045 + node.ring * 0.025;
  const progress = (introElapsed - delay) / 1.15;
  return Math.max(0, Math.min(1, progress));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function PlanetMaterial({ node }: { node: OrbitNodeDef }) {
  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(node.color) },
      uColorB: { value: new THREE.Color(node.colorTo) },
      uSeed: { value: node.ring * 1.7 + node.angle },
    }),
    [node],
  );

  if (node.gradient) {
    return (
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={planetVertexShader}
        fragmentShader={planetFragmentShader}
        transparent
        depthWrite
      />
    );
  }

  return (
    <meshStandardMaterial
      color={node.color}
      roughness={0.62}
      metalness={0.05}
      emissive={node.color}
      emissiveIntensity={0.08}
    />
  );
}

function PlanetSystem({ config, node, nodeIndex, reducedMotion }: PlanetSystemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const moonPivotRef = useRef<THREE.Group>(null);
  const startTimeRef = useRef<number | null>(null);
  const baseScale = scaleFor(node);
  const initiallyVisible = node.ring <= INITIAL_VISIBLE_RINGS;

  useEffect(() => {
    startTimeRef.current = null;
  }, [node.id]);

  useFrame(({ clock }) => {
    const elapsed = reducedMotion ? 0 : clock.getElapsedTime();
    if (startTimeRef.current === null) {
      startTimeRef.current = elapsed;
    }

    const introElapsed = reducedMotion || initiallyVisible ? 99 : elapsed - startTimeRef.current;
    const reveal = easeOutCubic(revealValue(introElapsed, node, nodeIndex));
    const point = pointForNodeAt(config, node, elapsed);
    const lift = (1 - reveal) * 0.16;

    groupRef.current?.position.set(point.x, point.y + lift, point.z);
    groupRef.current?.scale.setScalar(Math.max(0.001, reveal));

    if (moonPivotRef.current) {
      moonPivotRef.current.rotation.y = elapsed * (0.9 + node.ring * 0.06) + node.angle;
    }
  });

  const initialPoint = pointForNodeAt(config, node, 0);
  const moonDistance = baseScale * 2.15;

  return (
    <group
      ref={groupRef}
      position={[initialPoint.x, initialPoint.y, initialPoint.z]}
      scale={1}
    >
      <mesh>
        <sphereGeometry args={[baseScale, 32, 32]} />
        <PlanetMaterial node={node} />
      </mesh>

      {node.moonCount > 0 ? (
        <group ref={moonPivotRef}>
          {Array.from({ length: node.moonCount }, (_, moonIndex) => {
            const angle = (Math.PI * 2 * moonIndex) / node.moonCount;
            const distance = moonDistance + moonIndex * baseScale * 0.75;
            return (
              <mesh
                key={`${node.id}-moon-${moonIndex}`}
                position={[Math.cos(angle) * distance, baseScale * 0.2, Math.sin(angle) * distance]}
              >
                <sphereGeometry args={[baseScale * (moonIndex === 0 ? 0.3 : 0.22), 18, 18]} />
                <meshStandardMaterial color={node.moonColor} roughness={0.72} metalness={0.02} />
              </mesh>
            );
          })}
        </group>
      ) : null}
    </group>
  );
}

export function InstancedOrbitNodes3D({ config, nodes, reducedMotion }: InstancedOrbitNodes3DProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <PlanetSystem
          key={node.id}
          config={config}
          node={node}
          nodeIndex={index}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
