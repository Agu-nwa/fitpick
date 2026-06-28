"use client";

import { Component, Suspense, useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import type { Group } from "three";

type AvatarCanvasProps = {
  avatarUrl?: string | null;
  bodyPreset?: string;
  visualizationStyle?: string;
  posePreset?: string;
  autoRotate?: boolean;
  animatedPreview?: boolean;
};

class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function styleColor(style?: string) {
  if (style === "streetwear") return "#3b3f32";
  if (style === "editorial") return "#5a3840";
  if (style === "minimal") return "#8b806f";
  return "#5a3828";
}

function scaleForBody(bodyPreset?: string) {
  if (bodyPreset === "slim") return [0.86, 1, 0.86] as [number, number, number];
  if (bodyPreset === "athletic") return [1.08, 1, 1.02] as [number, number, number];
  if (bodyPreset === "curvy") return [1.1, 0.98, 1.06] as [number, number, number];
  if (bodyPreset === "plus") return [1.18, 0.98, 1.1] as [number, number, number];
  return [1, 1, 1] as [number, number, number];
}

function rotationForPose(posePreset?: string) {
  if (posePreset === "side") return [0, Math.PI / 2, 0] as [number, number, number];
  if (posePreset === "back") return [0, Math.PI, 0] as [number, number, number];
  return [0, 0, 0] as [number, number, number];
}

function AvatarModel({ url, posePreset, animatedPreview }: { url: string; posePreset?: string; animatedPreview?: boolean }) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const { actions, names } = useAnimations(gltf.animations, group);

  useEffect(() => {
    const selectedName = names.find((name) => name.toLowerCase().includes(String(posePreset || "").toLowerCase())) || names.find((name) => /walk|idle|stand/i.test(name));
    if (!selectedName || !actions[selectedName]) return;
    actions[selectedName]?.reset().fadeIn(0.2).play();
    return () => {
      actions[selectedName]?.fadeOut(0.2);
    };
  }, [actions, names, posePreset]);

  useFrame((state) => {
    if (!group.current || !animatedPreview || names.length) return;
    group.current.position.y = -1.35 + Math.sin(state.clock.elapsedTime * 2) * 0.015;
  });

  return (
    <group ref={group} rotation={rotationForPose(posePreset)} position={[0, -1.35, 0]} scale={1.65}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function AnimatedFallbackMannequin(props: AvatarCanvasProps) {
  const group = useRef<Group>(null);
  const poseRotation = rotationForPose(props.posePreset);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = poseRotation[1];
    if (props.animatedPreview || props.posePreset === "walking" || props.posePreset === "runway") {
      group.current.position.y = -0.55 + Math.sin(state.clock.elapsedTime * 3) * 0.018;
    }
  });

  return (
    <group ref={group} rotation={poseRotation} position={[0, -0.55, 0]}>
      <FallbackMannequin {...props} />
    </group>
  );
}

function FallbackMannequin({ bodyPreset, visualizationStyle, posePreset }: AvatarCanvasProps) {
  const color = styleColor(visualizationStyle);
  const scale = scaleForBody(bodyPreset);
  const isWalking = posePreset === "walking" || posePreset === "runway";

  return (
    <group scale={scale}>
      <mesh position={[0, 1.45, 0]} castShadow>
        <sphereGeometry args={[0.28, 36, 36]} />
        <meshStandardMaterial color="#b99f87" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.92, 16, 32]} />
        <meshStandardMaterial color={color} roughness={0.64} metalness={0.04} />
      </mesh>
      <mesh position={[-0.58, 0.82, 0]} rotation={[0, 0, isWalking ? 0.32 : 0.18]} castShadow>
        <capsuleGeometry args={[0.1, 0.72, 12, 20]} />
        <meshStandardMaterial color={color} roughness={0.66} />
      </mesh>
      <mesh position={[0.58, 0.82, 0]} rotation={[0, 0, isWalking ? -0.32 : -0.18]} castShadow>
        <capsuleGeometry args={[0.1, 0.72, 12, 20]} />
        <meshStandardMaterial color={color} roughness={0.66} />
      </mesh>
      <mesh position={[-0.18, -0.04, 0]} rotation={[isWalking ? 0.14 : 0, 0, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.95, 12, 20]} />
        <meshStandardMaterial color="#2a2824" roughness={0.72} />
      </mesh>
      <mesh position={[0.18, -0.04, 0]} rotation={[isWalking ? -0.14 : 0, 0, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.95, 12, 20]} />
        <meshStandardMaterial color="#2a2824" roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.62, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.04, 40]} />
        <meshStandardMaterial color="#d7cbbb" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function AvatarCanvas({ avatarUrl, bodyPreset, visualizationStyle, posePreset, autoRotate = true, animatedPreview = false }: AvatarCanvasProps) {
  const fallback = <AnimatedFallbackMannequin bodyPreset={bodyPreset} visualizationStyle={visualizationStyle} posePreset={posePreset} animatedPreview={animatedPreview} />;

  return (
    <Canvas shadows camera={{ position: [0, 1.1, 4.4], fov: 38 }} dpr={[1, 1.7]}>
      <color attach="background" args={["#f7f2ea"]} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={["#fff7ed", "#786c5f", 1.2]} />
      <directionalLight position={[3, 4, 3]} intensity={2.2} castShadow />
      <spotLight position={[-3, 3, 2]} intensity={0.85} angle={0.45} penumbra={0.8} />
      <Suspense fallback={fallback}>
        <CanvasErrorBoundary fallback={fallback}>
          {avatarUrl ? <AvatarModel url={avatarUrl} posePreset={posePreset} animatedPreview={animatedPreview} /> : fallback}
        </CanvasErrorBoundary>
      </Suspense>
      <ContactShadows position={[0, -1.2, 0]} opacity={0.28} scale={5} blur={2.6} far={2.4} />
      <OrbitControls enablePan={false} enableDamping autoRotate={autoRotate} autoRotateSpeed={0.9} minDistance={2.7} maxDistance={6} target={[0, 0.25, 0]} />
    </Canvas>
  );
}
