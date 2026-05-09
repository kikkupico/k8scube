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
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", 5, 20]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[-5, 5, -5]} intensity={0.3} color="#0ea5e9" />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[5, 8, 4]}
        intensity={0.5}
        color="#3b82f6"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Suspense fallback={null}>
        <Cube />
        {mode === "explore" && <Flows />}
        <ContactShadows
          position={[0, -1.01, 0]}
          opacity={0.6}
          scale={10}
          blur={2.4}
          far={2}
          color="#000000"
        />
        <Environment preset="night" environmentIntensity={0.1} />
      </Suspense>

      <CameraRig />
    </Canvas>
  );
}
