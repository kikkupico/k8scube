import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Cube } from "./Cube";
import { CameraRig } from "./CameraRig";
import { Flows } from "../modes/Flows";
import { useApp } from "../state/store";

export function Scene() {
  const mode = useApp((s) => s.mode);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4.5, 3.8, 5.2], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#f4f1ea"]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[5, 8, 4]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Suspense fallback={null}>
        <Cube />
        {mode === "explore" && <Flows />}
        <ContactShadows
          position={[0, -1.01, 0]}
          opacity={0.35}
          scale={10}
          blur={2.4}
          far={2}
        />
        <Environment preset="city" environmentIntensity={0.25} />
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
