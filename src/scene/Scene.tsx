import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Cube } from "./Cube";
import { CameraRig } from "./CameraRig";
import { Flows } from "../modes/Flows";
import { PodFlights } from "../sim/PodFlight";
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
      <color attach="background" args={["#ffffff"]} />
      <fog attach="fog" args={["#ffffff", 5, 22]} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[5, 10, 4]}
        intensity={0.65}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Suspense fallback={null}>
        <Cube />
        <PodFlights />
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
