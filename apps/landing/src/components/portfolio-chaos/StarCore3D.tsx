import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying vec3 vNormal;
  varying vec3 vPosition;

  float noise(vec3 p) {
    float a = sin(p.x * 9.4 + sin(p.y * 3.8 + uTime * 0.5) * 1.35 + uTime * 0.72);
    float b = sin(p.y * 10.8 + sin(p.z * 4.2 - uTime * 0.44) * 1.15 - uTime * 0.58);
    float c = sin((p.x + p.z) * 8.6 + sin(p.y * 5.2) * 0.9 + uTime * 0.38);
    return (a + b + c) / 3.0;
  }

  void main() {
    float rim = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 1.55);
    float plasma = noise(vPosition * 2.7) * 0.5 + 0.5;
    vec3 color = mix(uColorA, uColorB, plasma);
    color = mix(color, uColorC, rim * 0.85);
    float alpha = 0.82 + rim * 0.18;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function StarCore3D() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color("#4f46e5") },
      uColorB: { value: new THREE.Color("#7dd3fc") },
      uColorC: { value: new THREE.Color("#2563eb") },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.56, 96, 96]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.48}>
        <sphereGeometry args={[0.56, 64, 64]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh scale={2.18}>
        <sphereGeometry args={[0.56, 64, 64]} />
        <meshBasicMaterial color="#4f46e5" transparent opacity={0.055} depthWrite={false} />
      </mesh>
    </group>
  );
}
