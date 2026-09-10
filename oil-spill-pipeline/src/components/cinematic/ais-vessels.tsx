"use client";

import { type RefObject, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type { Line2, LineMaterial } from "three-stdlib";
import * as THREE from "three";
import { getOceanHeight } from "@/components/cinematic/ocean";
import { stageOpacity } from "@/components/cinematic/cinematic-math";
import { SLICK_ORIGIN, stageById } from "@/components/cinematic/stages";
import { jetbrainsMono } from "@/lib/fonts";
import { cn } from "@/lib/utils";

const AIS_STAGE = stageById("ais");
const ACCENT = "#8FB4C6";

/**
 * Sample AIS contacts for the demonstration — synthetic, not live vessel
 * traffic, and deliberately unnamed. Offsets are relative to the slick.
 * Several tracks cross the modelled corridor; none of that implies cause.
 */
const VESSELS: ReadonlyArray<{
  id: string;
  label: string;
  note: string;
  offset: readonly [number, number];
  heading: number;
  speed: number;
}> = [
  {
    id: "candidate-01",
    label: "Candidate 01",
    note: "Track intersection",
    offset: [-7, 11],
    heading: 0.5,
    speed: 0.16,
  },
  {
    id: "candidate-02",
    label: "Candidate 02",
    note: "Track intersection",
    offset: [5, 17],
    heading: -0.85,
    speed: 0.12,
  },
  {
    id: "candidate-03",
    label: "Candidate 03",
    note: "Outside corridor",
    offset: [-6, -7],
    heading: 1.25,
    speed: 0.14,
  },
];

/**
 * One shared set of geometries for every contact — each vessel reuses the
 * same buffers rather than allocating its own.
 */
function useSharedVesselGeometry() {
  return useMemo(
    () => ({
      hull: new THREE.BoxGeometry(0.72, 0.22, 2.7),
      bow: new THREE.ConeGeometry(0.4, 0.85, 4),
      deckhouse: new THREE.BoxGeometry(0.46, 0.34, 0.66),
      mast: new THREE.CylinderGeometry(0.024, 0.024, 0.52, 6),
      light: new THREE.SphereGeometry(0.055, 8, 8),
    }),
    []
  );
}

type SharedGeometry = ReturnType<typeof useSharedVesselGeometry>;

function VesselContact({
  vessel,
  geometry,
  progressRef,
  weight,
  hovered,
  onHover,
}: {
  vessel: (typeof VESSELS)[number];
  geometry: SharedGeometry;
  progressRef: RefObject<number>;
  weight: number;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trackRef = useRef<Line2>(null);
  const hullMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Historical track: a smooth run astern along the contact's heading.
  const trackPoints = useMemo(() => {
    const [ox, , oz] = SLICK_ORIGIN;
    const points: THREE.Vector3[] = [];
    for (let i = 8; i >= 0; i--) {
      const back = i * 2.1;
      // A gentle curve, so tracks don't read as ruler-straight lines.
      const drift = Math.sin(i * 0.4 + vessel.heading) * 0.6;
      points.push(
        new THREE.Vector3(
          ox + vessel.offset[0] - Math.sin(vessel.heading) * back + drift,
          0.16,
          oz + vessel.offset[1] - Math.cos(vessel.heading) * back
        )
      );
    }
    return points;
  }, [vessel]);

  useFrame((state) => {
    const opacity = stageOpacity(progressRef.current, AIS_STAGE.range, 0.06, true);
    const time = state.clock.elapsedTime;
    const visible = opacity > 0.01;

    if (trackRef.current) {
      trackRef.current.visible = visible;
      const material = trackRef.current.material as LineMaterial;
      material.opacity = opacity * (hovered ? 0.8 : 0.26) * weight;
      material.linewidth = hovered ? 2 : 1;
    }

    if (hullMaterialRef.current) {
      hullMaterialRef.current.emissiveIntensity = hovered ? 0.55 : 0.05;
    }

    if (!groupRef.current) return;
    groupRef.current.visible = visible;

    const [ox, , oz] = SLICK_ORIGIN;
    const travel = Math.sin(time * 0.09 + vessel.heading) * vessel.speed * 8;
    const x = ox + vessel.offset[0] + Math.sin(vessel.heading) * travel;
    const z = oz + vessel.offset[1] + Math.cos(vessel.heading) * travel;
    const y = getOceanHeight(x, z, time);

    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = vessel.heading;
    groupRef.current.rotation.z = Math.sin(time * 0.7 + vessel.offset[0]) * 0.05;
    groupRef.current.rotation.x = Math.sin(time * 0.55 + vessel.offset[1]) * 0.035;
  });

  return (
    <group>
      <group
        ref={groupRef}
        visible={false}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(vessel.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <mesh geometry={geometry.hull} position={[0, 0.1, 0]}>
          <meshStandardMaterial
            ref={hullMaterialRef}
            color="#7f8c99"
            metalness={0.35}
            roughness={0.6}
            emissive={ACCENT}
            emissiveIntensity={0.05}
          />
        </mesh>
        <mesh
          geometry={geometry.bow}
          position={[0, 0.1, 1.72]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#94a1ae" metalness={0.2} roughness={0.72} />
        </mesh>
        <mesh geometry={geometry.deckhouse} position={[0, 0.36, -0.66]}>
          <meshStandardMaterial color="#aab6c2" metalness={0.3} roughness={0.55} />
        </mesh>
        <mesh geometry={geometry.mast} position={[0, 0.78, -0.66]}>
          <meshStandardMaterial color="#c2ccd6" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh geometry={geometry.light} position={[0, 1.08, -0.66]}>
          <meshBasicMaterial color="#e8f2f7" />
        </mesh>

        {hovered && (
          <Html position={[0, 1.1, 0]} center distanceFactor={16}>
            <div
              className={cn(
                "whitespace-nowrap border-l border-[#8FB4C6]/60 bg-[#05090f]/90 px-2 py-1 text-[10px] leading-tight text-white/80",
                jetbrainsMono.className
              )}
            >
              <div>{vessel.label}</div>
              <div className="text-white/40">{vessel.note}</div>
            </div>
          </Html>
        )}
      </group>

      <Line
        ref={trackRef}
        points={trackPoints}
        color={ACCENT}
        lineWidth={1}
        transparent
        opacity={0}
        dashed
        dashSize={0.7}
        gapSize={0.5}
      />
    </group>
  );
}

/**
 * AIS lineup: several candidate contacts with historical tracks, some
 * crossing the modelled drift corridor. Investigative leads only — nothing
 * here asserts that any vessel caused the slick (parent CLAUDE.md §22).
 */
export function AisVessels({
  progressRef,
  weight = 1,
}: {
  progressRef: RefObject<number>;
  weight?: number;
}) {
  const geometry = useSharedVesselGeometry();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <group>
      {VESSELS.map((vessel) => (
        <VesselContact
          key={vessel.id}
          vessel={vessel}
          geometry={geometry}
          progressRef={progressRef}
          weight={weight}
          hovered={hoveredId === vessel.id}
          onHover={setHoveredId}
        />
      ))}
    </group>
  );
}
