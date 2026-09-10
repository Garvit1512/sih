"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { CatmullRomLine, PerformanceMonitor } from "@react-three/drei";
import type { Line2, LineMaterial } from "three-stdlib";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { Ocean, getOceanHeight } from "@/components/cinematic/ocean";
import { NightSky, MOON_POSITION } from "@/components/cinematic/night-sky";
import { HeroVessel } from "@/components/cinematic/hero-vessel";
import { SatellitePass } from "@/components/cinematic/satellite";
import { OilSlick } from "@/components/cinematic/oil-slick";
import { AisVessels } from "@/components/cinematic/ais-vessels";
import { CinematicCamera } from "@/components/cinematic/cinematic-camera";
import { useScrollProgressRef } from "@/hooks/use-cinematic-scroll";
import { stageOpacity } from "@/components/cinematic/cinematic-math";
import { CAMERA_KEYFRAMES, SLICK_ORIGIN, stageById } from "@/components/cinematic/stages";

// Muted well below the UI accent: analytical geometry should read as
// restrained annotation over the scene, not glowing cyan.
const ACCENT = "#8FB4C6";

const RULE_OUT_STAGE = stageById("rule-out");
const DRIFT_STAGE = stageById("drift");

/* ---------------------------------------------------------------------- */
/* Rule-out — restrained exclusion markers anchored to the environment.    */
/* ---------------------------------------------------------------------- */

const RULE_OUT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-11, 6],
  [-14, -5],
];

function RuleOutMarkers({
  progressRef,
  weight,
}: {
  progressRef: RefObject<number>;
  weight: number;
}) {
  const refs = useRef<Array<THREE.Group | null>>([]);

  useFrame((state) => {
    const opacity = stageOpacity(
      progressRef.current,
      RULE_OUT_STAGE.range,
      0.05,
      false
    );
    const [ox, oy, oz] = SLICK_ORIGIN;

    RULE_OUT_OFFSETS.forEach((offset, i) => {
      const group = refs.current[i];
      if (!group) return;
      const x = ox + offset[0];
      const z = oz + offset[1];
      const y = getOceanHeight(x, z, state.clock.elapsedTime) + oy + 0.06;
      group.position.set(x, y, z);
      group.visible = opacity > 0.01;
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity =
            opacity * 0.38 * weight;
        }
      });
    });
  });

  return (
    <group>
      {RULE_OUT_OFFSETS.map((offset, i) => (
        <group
          key={offset.join(",")}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.42, 0.5, 32]} />
            <meshBasicMaterial
              color="#9fb2c4"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Cross tick — reads as "checked and excluded", not just a ring */}
          <mesh rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.7, 0.02]} />
            <meshBasicMaterial
              color="#9fb2c4"
              transparent
              opacity={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Backward drift — hindcast path, ghost positions, flowing markers.       */
/* ---------------------------------------------------------------------- */

const DRIFT_GHOST_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [2.2, 3.4],
  [4.8, 7.6],
  [7.0, 12.8],
];

const FLOW_COUNT = 14;

function DriftPath({
  progressRef,
  weight,
}: {
  progressRef: RefObject<number>;
  weight: number;
}) {
  const lineRef = useRef<Line2>(null);
  const ghostRefs = useRef<Array<THREE.Mesh | null>>([]);
  const flowRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const points = useMemo(() => {
    const [ox, oy, oz] = SLICK_ORIGIN;
    return [
      new THREE.Vector3(ox, oy + 0.25, oz),
      ...DRIFT_GHOST_OFFSETS.map(
        ([dx, dz]) => new THREE.Vector3(ox + dx, oy + 0.25, oz + dz)
      ),
    ];
  }, []);

  // Our own copy of the curve drei draws, so flow markers can be sampled
  // along exactly the same path.
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points, false, "chordal"),
    [points]
  );

  useFrame((state) => {
    const opacity = stageOpacity(progressRef.current, DRIFT_STAGE.range, 0.06, true);
    const time = state.clock.elapsedTime;
    const visible = opacity > 0.01;

    if (lineRef.current) {
      (lineRef.current.material as LineMaterial).opacity = opacity * 0.85 * weight;
      lineRef.current.visible = visible;
    }

    DRIFT_GHOST_OFFSETS.forEach(([dx, dz], i) => {
      const mesh = ghostRefs.current[i];
      if (!mesh) return;
      const [ox, oy, oz] = SLICK_ORIGIN;
      const x = ox + dx;
      const z = oz + dz;
      const y = getOceanHeight(x, z, time) + oy + 0.18;
      mesh.position.set(x, y, z);
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.95 * weight;
    });

    // Markers streaming backward along the modeled path — the direction of
    // the hindcast, not decoration.
    const mesh = flowRef.current;
    if (mesh) {
      mesh.visible = visible;
      for (let i = 0; i < FLOW_COUNT; i++) {
        const t = ((time * 0.055 + i / FLOW_COUNT) % 1);
        const point = curve.getPointAt(t);
        const surface = getOceanHeight(point.x, point.z, time);
        dummy.position.set(point.x, surface + 0.22, point.z);
        // Fade in and out at the ends of the run so they don't pop.
        const ends = Math.sin(t * Math.PI);
        dummy.scale.setScalar(visible ? 0.5 + ends * 0.9 : 0.0001);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8 * weight;
    }
  });

  return (
    <group>
      <CatmullRomLine
        ref={lineRef}
        points={points}
        color={ACCENT}
        lineWidth={2.4}
        transparent
        opacity={0}
        curveType="chordal"
        visible={false}
      />
      {DRIFT_GHOST_OFFSETS.map((offset, i) => (
        <mesh
          key={offset.join(",")}
          ref={(el) => {
            ghostRefs.current[i] = el;
          }}
        >
          <ringGeometry args={[0.34, 0.46, 24]} />
          <meshBasicMaterial
            color={ACCENT}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={flowRef}
        args={[undefined, undefined, FLOW_COUNT]}
        visible={false}
      >
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0} />
      </instancedMesh>
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Canvas host                                                            */
/* ---------------------------------------------------------------------- */

interface CinematicSceneProps {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
  /**
   * `webgl` renders the full procedural environment (ocean, sky, hero
   * vessel, satellite). `video` hands the environment to the cinematic
   * plates behind the canvas and keeps only the analytical layer, at
   * reduced visual weight, composited over the footage.
   */
  environmentMode?: "webgl" | "video";
}

export function CinematicScene({
  scrollYProgress,
  reducedMotion,
  environmentMode = "webgl",
}: CinematicSceneProps) {
  const [quality, setQuality] = useState<"high" | "low">("high");
  const progressRef = useScrollProgressRef(scrollYProgress);
  const initialFrame = CAMERA_KEYFRAMES[0];

  // R3F measures its container once on mount. If that happens before the
  // sticky/dvh layout has settled, the drawing buffer is sized to a stale
  // box and the canvas ends up letterboxed inside its own layer for the
  // life of the page. Nudging a resize on the next frames forces a
  // re-measure against the settled viewport.
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event("resize"));
    const raf = requestAnimationFrame(fire);
    const timer = window.setTimeout(fire, 220);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, []);

  const showEnvironment = environmentMode === "webgl";
  // Analytical objects sit lighter over footage than they do over the
  // procedural ocean, so they annotate the plate instead of fighting it.
  const weight = showEnvironment ? 1 : 0.55;

  return (
    <Canvas
      dpr={quality === "high" ? [1, 2] : [1, 1]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        // Transparent so the cinematic plate shows through in video mode.
        alpha: true,
      }}
      style={{ background: "transparent", width: "100%", height: "100%", display: "block" }}
      resize={{ scroll: false, debounce: 0 }}
      camera={{
        position: [...initialFrame.position],
        fov: initialFrame.fov,
        near: 0.1,
        far: 340,
      }}
    >
      <PerformanceMonitor
        onDecline={() => setQuality("low")}
        onIncline={() => setQuality("high")}
      />

      {/* Environment layer — only when the procedural scene is the
          environment. In video mode the canvas stays transparent and the
          cinematic plate behind it provides sky, sea and horizon. */}
      {showEnvironment && (
        <>
          <color attach="background" args={["#05090f"]} />
          <fog attach="fog" args={["#0a1622", 30, 210]} />
          <NightSky />
          <Ocean segments={quality === "high" ? 200 : 110} />
          <HeroVessel />
          <SatellitePass progressRef={progressRef} weight={weight} />
        </>
      )}

      {/* Moonlight for the solid objects. Kept in both modes so the
          analytical geometry is still lit when it sits over footage. */}
      <ambientLight intensity={showEnvironment ? 0.9 : 0.7} color="#7f97ad" />
      <directionalLight
        position={MOON_POSITION}
        intensity={showEnvironment ? 2.4 : 1.5}
        color="#dbe7f2"
      />
      {/* Cool fill from the camera side. Without it the vessels sit with
          their lit face away from us and read as flat black cut-outs. */}
      <directionalLight
        position={[30, 22, 60]}
        intensity={0.85}
        color="#8ea8c0"
      />

      <CinematicCamera
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />

      {/* Analytical layer — always present, in both modes. */}
      <OilSlick progressRef={progressRef} weight={weight} />
      <RuleOutMarkers progressRef={progressRef} weight={weight} />
      <DriftPath progressRef={progressRef} weight={weight} />
      <AisVessels progressRef={progressRef} weight={weight} />
    </Canvas>
  );
}
