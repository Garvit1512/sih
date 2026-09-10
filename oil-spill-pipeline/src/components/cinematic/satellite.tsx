"use client";

import { type RefObject, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2, LineMaterial } from "three-stdlib";
import * as THREE from "three";
import { getOceanHeight } from "@/components/cinematic/ocean";
import { stageOpacity, smoothstep } from "@/components/cinematic/cinematic-math";
import { SLICK_ORIGIN, stageById } from "@/components/cinematic/stages";

const SAR_STAGE = stageById("sar");
const ACCENT = "#8FB4C6";

const FOOTPRINT_HALF = 11;
/**
 * The spacecraft sits high and well off to one side, so from the SAR
 * camera it reads at a shallow angle in the upper frame with the ocean
 * still filling the lower frame — and the beam arrives obliquely, the way
 * a side-looking radar actually images.
 */
const SATELLITE_ALTITUDE = 15;
const SATELLITE_OFFSET_X = 13;
const SATELLITE_OFFSET_Z = -19;

/**
 * Corner-bracket points for the acquisition footprint — four disconnected
 * L marks rather than a closed rectangle, which reads as a plain wireframe
 * box. Flat point pairs for drei's `Line segments` mode.
 */
function footprintBracketPoints(
  center: readonly [number, number, number],
  half: number,
  arm: number
): THREE.Vector3[] {
  const [cx, cy, cz] = center;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const points: THREE.Vector3[] = [];
  for (const [sx, sz] of corners) {
    const cornerX = cx + sx * half;
    const cornerZ = cz + sz * half;
    points.push(
      new THREE.Vector3(cornerX, cy, cornerZ),
      new THREE.Vector3(cornerX - sx * arm, cy, cornerZ),
      new THREE.Vector3(cornerX, cy, cornerZ),
      new THREE.Vector3(cornerX, cy, cornerZ - sz * arm)
    );
  }
  return points;
}

const BEAM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    // Strongest just below the sensor, thinning out toward the sea surface,
    // with both ends feathered so the cone never shows a hard edge.
    float alongFade = mix(0.05, 1.0, pow(vUv.y, 2.2));
    float topFeather = smoothstep(0.0, 0.35, vUv.y);
    float bottomFeather = 1.0 - smoothstep(0.9, 1.0, vUv.y);
    gl_FragColor = vec4(uColor, alongFade * topFeather * bottomFeather * uOpacity);
  }
`;

const PATCH_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    float falloff = pow(1.0 - clamp(d, 0.0, 1.0), 2.2);
    gl_FragColor = vec4(uColor, falloff * uOpacity);
  }
`;

/** Low-poly Sentinel-style spacecraft: bus, solar wings, SAR antenna. */
function SatelliteBody() {
  const navLightRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!navLightRef.current) return;
    // Slow beacon blink, not a strobe.
    const on = Math.sin(state.clock.elapsedTime * 2.2) > 0.55;
    navLightRef.current.scale.setScalar(on ? 1.35 : 0.55);
  });

  return (
    <group scale={2.4}>
      {/* Bus */}
      <mesh castShadow={false}>
        <boxGeometry args={[0.85, 0.52, 0.5]} />
        <meshStandardMaterial color="#9aa6b2" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* Solar wings */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.35, 0, 0]}>
          <mesh>
            <boxGeometry args={[1.7, 0.03, 0.62]} />
            <meshStandardMaterial
              color="#2d4a68"
              metalness={0.55}
              roughness={0.42}
              emissive="#16304a"
              emissiveIntensity={0.85}
            />
          </mesh>
          {/* Wing spar back to the bus */}
          <mesh position={[-side * 0.95, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.55, 8]} />
            <meshStandardMaterial color="#8d99a6" metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* SAR antenna — long flat panel slung beneath the bus */}
      <mesh position={[0, -0.36, 0]} rotation={[0, 0, 0.06]}>
        <boxGeometry args={[1.5, 0.05, 0.22]} />
        <meshStandardMaterial color="#c3ccd6" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Comms antenna */}
      <mesh position={[0, 0.42, 0.05]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.14, 0.26, 12, 1, true]} />
        <meshStandardMaterial
          color="#aab4c0"
          metalness={0.5}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Navigation light */}
      <mesh ref={navLightRef} position={[0.5, 0.16, 0.26]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#e2705f" />
      </mesh>
    </group>
  );
}

/**
 * The SAR acquisition pass: the spacecraft tracks across the scene while a
 * soft sensor beam sweeps the sea surface, leaving a bracketed acquisition
 * footprint behind it. Everything is driven off scroll progress within the
 * SAR stage, so scrubbing backward reverses the pass.
 */
export function SatellitePass({
  progressRef,
  weight = 1,
}: {
  progressRef: RefObject<number>;
  weight?: number;
}) {
  const satelliteRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const patchRef = useRef<THREE.Mesh>(null);
  const bracketRef = useRef<Line2>(null);

  // Lifted just clear of the mean surface so the marks read as a projected
  // annotation rather than something floating at an arbitrary height.
  const bracketPoints = useMemo(
    () =>
      footprintBracketPoints(
        [SLICK_ORIGIN[0], 0.7, SLICK_ORIGIN[2]],
        FOOTPRINT_HALF,
        3.2
      ),
    []
  );

  const beamUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(ACCENT) },
      uOpacity: { value: 0 },
    }),
    []
  );

  const patchUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(ACCENT) },
      uOpacity: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const progress = progressRef.current;
    // Closes out inside its own stage, so the pass is gone before the
    // slick beat begins rather than trailing a wedge across it.
    const opacity = stageOpacity(
      progress,
      [SAR_STAGE.range[0], SAR_STAGE.range[1] - 0.035],
      0.035,
      false
    );
    const localT = smoothstep(
      (progress - SAR_STAGE.range[0]) / (SAR_STAGE.range[1] - SAR_STAGE.range[0])
    );
    const time = state.clock.elapsedTime;
    const [ox, , oz] = SLICK_ORIGIN;

    const visible = opacity > 0.01;

    // Where the sensor is looking right now, on the sea surface.
    const targetZ = oz - FOOTPRINT_HALF + localT * FOOTPRINT_HALF * 2;
    const targetY = getOceanHeight(ox, targetZ, time);
    const target = new THREE.Vector3(ox, targetY, targetZ);

    const satellitePosition = new THREE.Vector3(
      ox + SATELLITE_OFFSET_X,
      SATELLITE_ALTITUDE,
      targetZ + SATELLITE_OFFSET_Z
    );

    if (satelliteRef.current) {
      satelliteRef.current.visible = visible;
      satelliteRef.current.position.copy(satellitePosition);
      // Keep the sensor face pointed at what it's imaging.
      satelliteRef.current.lookAt(target);
      satelliteRef.current.rotateX(Math.PI / 2);
    }

    if (beamRef.current) {
      beamRef.current.visible = visible;
      const direction = new THREE.Vector3().subVectors(target, satellitePosition);
      const distance = direction.length();
      const midpoint = new THREE.Vector3()
        .addVectors(satellitePosition, target)
        .multiplyScalar(0.5);
      beamRef.current.position.copy(midpoint);
      beamRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
      );
      // Cylinder geometry is unit height; stretch it to span the gap.
      beamRef.current.scale.set(1, distance, 1);
      const beamMaterial = beamRef.current.material as THREE.ShaderMaterial;
      // Deliberately faint — a sensor looking, not a searchlight.
      beamMaterial.uniforms.uOpacity.value = opacity * 0.09 * weight;
    }

    if (patchRef.current) {
      patchRef.current.visible = visible;
      patchRef.current.position.set(ox, targetY + 0.06, targetZ);
      const patchMaterial = patchRef.current.material as THREE.ShaderMaterial;
      patchMaterial.uniforms.uOpacity.value = opacity * 0.2 * weight;
    }

    if (bracketRef.current) {
      bracketRef.current.visible = visible;
      (bracketRef.current.material as LineMaterial).opacity =
        opacity * 0.3 * weight;
    }
  });

  return (
    <group>
      <group ref={satelliteRef} visible={false}>
        <SatelliteBody />
      </group>

      {/* Sensor beam — a soft, wide-based cone from the SAR antenna down */}
      <mesh ref={beamRef} visible={false}>
        <cylinderGeometry args={[0.12, 1.3, 1, 24, 1, true]} />
        <shaderMaterial
          vertexShader={BEAM_VERTEX}
          fragmentShader={BEAM_FRAGMENT}
          uniforms={beamUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Illuminated patch where the beam meets the water */}
      <mesh ref={patchRef} rotation-x={-Math.PI / 2} visible={false}>
        <planeGeometry args={[9, 9]} />
        <shaderMaterial
          vertexShader={BEAM_VERTEX}
          fragmentShader={PATCH_FRAGMENT}
          uniforms={patchUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <Line
        ref={bracketRef}
        points={bracketPoints}
        segments
        color={ACCENT}
        lineWidth={1.4}
        transparent
        opacity={0}
      />
    </group>
  );
}
