"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WAVE_GLSL, getOceanHeight } from "@/components/cinematic/ocean";

/** Where the hero vessel sits, and how big it reads from the opening frame. */
export const HERO_VESSEL_ORIGIN: readonly [number, number] = [27, -56];
export const HERO_VESSEL_HEADING = -1.05;

const HULL_LENGTH = 32;
const HULL_WIDTH = 5.6;

/**
 * A laden products tanker, built from primitives: hull with a wedge bow,
 * deck, cargo tank domes and piping, aft superstructure, funnel, mast, and
 * navigation lights. Deliberately low-poly — it needs to read as a ship in
 * silhouette against a moonlit horizon, not to be inspected up close.
 */
function VesselGeometry() {
  const portLightRef = useRef<THREE.Mesh>(null);
  const starboardLightRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Navigation lights breathe rather than strobe.
    const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 1.4) * 0.2;
    portLightRef.current?.scale.setScalar(pulse);
    starboardLightRef.current?.scale.setScalar(pulse);
  });

  const hullMaterial = (
    <meshStandardMaterial color="#5b6875" metalness={0.25} roughness={0.78} />
  );

  return (
    <group>
      {/* Hull */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[HULL_WIDTH, 2.4, HULL_LENGTH]} />
        {hullMaterial}
      </mesh>

      {/* Bow wedge */}
      <mesh
        position={[0, 0.35, HULL_LENGTH / 2 + 1.4]}
        rotation={[Math.PI / 2, Math.PI / 4, 0]}
      >
        <coneGeometry args={[HULL_WIDTH * 0.72, 3.2, 4]} />
        {hullMaterial}
      </mesh>

      {/* Boot-top stripe at the waterline — reads as draught marking */}
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[HULL_WIDTH + 0.06, 0.55, HULL_LENGTH - 0.4]} />
        <meshStandardMaterial color="#5d2f2a" metalness={0.2} roughness={0.85} />
      </mesh>

      {/* Main deck */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[HULL_WIDTH - 0.5, 0.22, HULL_LENGTH - 1.2]} />
        <meshStandardMaterial color="#6c7986" metalness={0.25} roughness={0.72} />
      </mesh>

      {/* Cargo tank domes */}
      {[-7.5, -3.8, -0.1, 3.6, 7.3].map((z) => (
        <mesh key={z} position={[0, 1.95, z]}>
          <cylinderGeometry args={[0.75, 0.85, 0.6, 12]} />
          <meshStandardMaterial
            color="#6d7885"
            metalness={0.45}
            roughness={0.55}
          />
        </mesh>
      ))}

      {/* Deck piping run */}
      <mesh position={[1.1, 1.95, -1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 17, 8]} />
        <meshStandardMaterial color="#7c8894" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Aft superstructure */}
      <group position={[0, 0, -HULL_LENGTH / 2 + 3.4]}>
        <mesh position={[0, 2.6, 0]}>
          <boxGeometry args={[3.6, 2, 3.4]} />
          <meshStandardMaterial color="#8b96a2" metalness={0.25} roughness={0.65} />
        </mesh>
        <mesh position={[0, 4.3, 0]}>
          <boxGeometry args={[3.2, 1.5, 3]} />
          <meshStandardMaterial color="#98a3af" metalness={0.25} roughness={0.6} />
        </mesh>
        {/* Bridge window band */}
        <mesh position={[0, 4.6, 1.52]}>
          <boxGeometry args={[3.0, 0.55, 0.08]} />
          <meshBasicMaterial color="#d9e6ef" />
        </mesh>
        {/* Funnel */}
        <mesh position={[0, 5.9, -0.9]}>
          <cylinderGeometry args={[0.55, 0.65, 1.6, 10]} />
          <meshStandardMaterial color="#3d474f" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* Mast + masthead light */}
        <mesh position={[0, 6.3, 1.2]}>
          <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
          <meshStandardMaterial color="#aab4bf" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 7.6, 1.2]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color="#f2f7fa" />
        </mesh>
      </group>

      {/* Foremast */}
      <mesh position={[0, 3.1, HULL_LENGTH / 2 - 2.4]}>
        <cylinderGeometry args={[0.05, 0.05, 2.9, 6]} />
        <meshStandardMaterial color="#aab4bf" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Sidelights: red to port, green to starboard */}
      <mesh ref={portLightRef} position={[-HULL_WIDTH / 2 - 0.1, 2.2, 4]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color="#e0554a" />
      </mesh>
      <mesh ref={starboardLightRef} position={[HULL_WIDTH / 2 + 0.1, 2.2, 4]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color="#4fbe87" />
      </mesh>

      {/* A little working deck light, warm against all the cold blue */}
      <mesh position={[0, 2.4, -8]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#f0d9a8" />
      </mesh>
    </group>
  );
}

const WAKE_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  ${WAVE_GLSL}

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Sample the ocean at this vertex's true world position, so the wake
    // lies on the moving surface however the ship is rotated.
    vec4 world = modelMatrix * vec4(pos, 1.0);
    float height = waveHeight(world.xz, uTime);

    world.y += height + 0.05;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WAKE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    // vUv.y runs from the stern (0) astern to the tail of the wake (1).
    float astern = vUv.y;
    float lateral = abs(vUv.x - 0.5) * 2.0;

    // Classic diverging V: the foam edge moves outboard the further astern
    // you go, so the visible band tracks that expanding wedge.
    float vEdge = 0.12 + astern * 0.78;
    float band = 1.0 - smoothstep(0.0, 0.34, abs(lateral - vEdge));

    // Churned water filling the wedge, strongest right behind the stern.
    float inner = (1.0 - smoothstep(0.0, vEdge, lateral)) * (1.0 - astern) * 0.55;

    // Break it up so it never reads as a solid painted stripe.
    float churn =
      sin(vUv.x * 42.0 + uTime * 2.1) * sin(vUv.y * 26.0 - uTime * 1.4);
    float texture = 0.72 + 0.28 * churn;

    float fade = (1.0 - smoothstep(0.35, 1.0, astern));
    float alpha = (band * 0.5 + inner) * texture * fade * uOpacity;

    gl_FragColor = vec4(vec3(0.66, 0.74, 0.8), clamp(alpha, 0.0, 1.0));
  }
`;

function Wake() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(16, 46, 48, 96);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 0.5 } }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  // Sits astern of the hull, running away from the bow.
  return (
    <mesh geometry={geometry} position={[0, 0, -HULL_LENGTH / 2 - 21]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={WAKE_VERTEX}
        fragmentShader={WAKE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * The hero subject: one large vessel underway, present from the opening
 * frame. It carries the story — a ship at sea at night, before anything is
 * known about it. Nothing here asserts it is responsible for anything.
 */
export function HeroVessel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const time = state.clock.elapsedTime;
    // A long, slow transit — always underway, never wandering out of frame.
    const travel = Math.sin(time * 0.032) * 13;
    const x = HERO_VESSEL_ORIGIN[0] + Math.sin(HERO_VESSEL_HEADING) * travel;
    const z = HERO_VESSEL_ORIGIN[1] + Math.cos(HERO_VESSEL_HEADING) * travel;

    // A ship this size rides the swell rather than tracking every ripple,
    // so it takes a damped fraction of the local wave height.
    const height = getOceanHeight(x, z, time);
    group.position.set(x, height * 0.45 - 0.25, z);

    // Pitch and roll sampled from the surface a little fore and aft.
    const fore = getOceanHeight(x, z + 9, time);
    const aft = getOceanHeight(x, z - 9, time);
    const port = getOceanHeight(x - 4, z, time);
    const starboard = getOceanHeight(x + 4, z, time);

    group.rotation.y = HERO_VESSEL_HEADING;
    group.rotation.x = THREE.MathUtils.clamp((aft - fore) * 0.035, -0.05, 0.05);
    group.rotation.z = THREE.MathUtils.clamp(
      (port - starboard) * 0.045,
      -0.06,
      0.06
    );
  });

  return (
    <group ref={groupRef}>
      <VesselGeometry />
      <Wake />
    </group>
  );
}
