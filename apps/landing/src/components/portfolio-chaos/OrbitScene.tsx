import { AdaptiveDpr, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { InstancedOrbitNodes3D } from "./InstancedOrbitNodes3D";
import { OrbitNodeLabels3D } from "./OrbitNodeLabels3D";
import { OrbitRings3D } from "./OrbitRings3D";
import { ORBIT_CONFIGS } from "./orbitData";
import { clamp } from "./orbitMath";
import { ORBIT_CAMERA } from "./orbitSimulation";
import { StarCore3D } from "./StarCore3D";
import { ZoomControls } from "./ZoomControls";
import type { ScaleId } from "./types";

interface OrbitSceneProps {
  activeId: ScaleId;
  mobile: boolean;
  reducedMotion: boolean;
  userInteracted: boolean;
  visibleRingCount: number;
  onUserInteract: () => void;
}

interface ControlsRef {
  current: any;
}

const CAMERA_TARGET = new THREE.Vector3(
  ORBIT_CAMERA.target.x,
  ORBIT_CAMERA.target.y,
  ORBIT_CAMERA.target.z,
);

function CameraRig({ mobile }: { mobile: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(
      mobile ? 0.25 : ORBIT_CAMERA.position.x,
      mobile ? 4.7 : ORBIT_CAMERA.position.y,
      mobile ? 8.9 : ORBIT_CAMERA.position.z,
    );
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }, [camera, mobile]);

  return null;
}

function OrbitStage({
  mobile,
  reducedMotion,
  userInteracted,
  visibleRingCount,
  controlsRef,
  onUserInteract,
}: OrbitSceneProps & {
  controlsRef: ControlsRef;
}) {
  const config = ORBIT_CONFIGS.holding;
  const nodes = useMemo(
    () => {
      const visibleNodes = config.nodes.filter((node) => node.ring <= visibleRingCount);
      return mobile ? visibleNodes.slice(0, config.mobileNodeLimit) : visibleNodes;
    },
    [config, mobile, visibleRingCount],
  );

  return (
    <>
      <CameraRig mobile={mobile} />
      <ambientLight intensity={1.55} />
      <directionalLight position={[3.8, 5.4, 4]} intensity={1.45} />
      <pointLight position={[-2.5, 2.2, -3]} intensity={0.85} color="#dbeafe" />
      <pointLight position={[0, 0.2, 0]} intensity={2.3} color="#7dd3fc" />

      <group position={[0.45, -0.18, 0]} rotation={[0.02, 0, 0]}>
        <OrbitRings3D config={config} visibleRingCount={visibleRingCount} reducedMotion={reducedMotion} />
        <InstancedOrbitNodes3D config={config} nodes={nodes} reducedMotion={reducedMotion} />
        <OrbitNodeLabels3D config={config} nodes={nodes} mobile={mobile} reducedMotion={reducedMotion} />
        <StarCore3D />
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.46}
        autoRotate={!reducedMotion && !userInteracted}
        autoRotateSpeed={0.22}
        target={CAMERA_TARGET}
        minPolarAngle={Math.PI / 4.6}
        maxPolarAngle={Math.PI / 2.12}
        onStart={onUserInteract}
      />
      <AdaptiveDpr pixelated={false} />
    </>
  );
}

export function OrbitScene(props: OrbitSceneProps) {
  const controlsRef = useRef<any>(null);

  const zoomBy = useCallback(
    (factor: number) => {
      const controls = controlsRef.current;
      const camera = controls?.object as THREE.PerspectiveCamera | undefined;
      const target = controls?.target as THREE.Vector3 | undefined;
      if (!camera || !target) {
        return;
      }

      const offset = camera.position.clone().sub(target);
      const nextDistance = clamp(offset.length() * factor, 3.2, 10.2);
      offset.setLength(nextDistance);
      camera.position.copy(target).add(offset);
      camera.updateProjectionMatrix();
      controls.update();
      props.onUserInteract();
    },
    [props],
  );

  return (
    <div
      className="orbitSceneShell"
      data-scale={props.activeId}
      data-visible-rings={props.visibleRingCount}
    >
      <Canvas
        className="orbitSceneCanvas"
        camera={{
          position: props.mobile
            ? [0.25, 4.7, 8.9]
            : [ORBIT_CAMERA.position.x, ORBIT_CAMERA.position.y, ORBIT_CAMERA.position.z],
          fov: props.mobile ? 48 : ORBIT_CAMERA.fov,
        }}
        dpr={props.mobile ? [1, 1.6] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <OrbitStage {...props} controlsRef={controlsRef} />
      </Canvas>

      <ZoomControls onZoomIn={() => zoomBy(0.84)} onZoomOut={() => zoomBy(1.18)} />

      <p className="orbitSceneHint" aria-hidden="true">
        Потяните сцену, чтобы повернуть. Приближайте через + / −.
      </p>
    </div>
  );
}
