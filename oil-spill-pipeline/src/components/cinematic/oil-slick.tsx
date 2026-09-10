"use client";

import { type RefObject, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WAVE_GLSL } from "@/components/cinematic/ocean";
import { MOON_DIRECTION } from "@/components/cinematic/night-sky";
import { stageOpacity, smoothstep } from "@/components/cinematic/cinematic-math";
import { SLICK_ORIGIN, stageById } from "@/components/cinematic/stages";

const SLICK_STAGE = stageById("slick");

const BASE_RADIUS = 3.4;
/** Anisotropy of the patch — wind-stretched along x. */
const STRETCH_X = 1.35;
const STRETCH_Z = 0.8;
/** Plane must comfortably contain the widest possible boundary. */
const PATCH_WIDTH = BASE_RADIUS * STRETCH_X * 3.4;
const PATCH_DEPTH = BASE_RADIUS * STRETCH_Z * 3.4;

/**
 * The irregular boundary, defined analytically so it can be evaluated in the
 * fragment shader. A densely tessellated plane carries the geometry (so the
 * sheet conforms to every wave), and this function decides which fragments
 * are actually oil — which also gives a feathered edge for free, instead of
 * the hard silhouette of a cut polygon.
 */
const BOUNDARY_GLSL = /* glsl */ `
  float slickBoundary(float angle) {
    return 1.0
      + 0.26 * sin(angle * 2.1 + 1.7)
      + 0.17 * sin(angle * 3.7 + 0.4)
      + 0.09 * sin(angle * 6.3 + 2.9)
      + 0.05 * sin(angle * 11.1 + 1.1);
  }
`;

const SLICK_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWorldOffset;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vLocal;

  ${WAVE_GLSL}

  void main() {
    vec3 pos = position;

    // Sample the ocean's wave field at this vertex's ABSOLUTE world position
    // so the sheet deforms with exactly the surface it floats on, rather than
    // bobbing as one rigid plate.
    vec2 worldXZ = pos.xz + uWorldOffset;
    float height = waveHeight(worldXZ, uTime);
    vec2 slope = waveSlope(worldXZ, uTime);

    // Sit a hair proud of the water so it never z-fights the ocean.
    pos.y += height + 0.03;

    vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vLocal = pos.xz;

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SLICK_FRAGMENT = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uSheenA;
  uniform vec3 uSheenB;
  uniform vec3 uLightDir;
  uniform float uOpacity;
  uniform float uSpread;
  uniform float uBaseRadius;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vLocal;

  ${BOUNDARY_GLSL}

  void main() {
    // Work in un-stretched space so the lobed boundary stays coherent.
    vec2 e = vec2(vLocal.x / ${STRETCH_X.toFixed(3)}, vLocal.y / ${STRETCH_Z.toFixed(3)});
    float radius = length(e);
    float angle = atan(e.y, e.x);
    float boundary = uBaseRadius * slickBoundary(angle) * uSpread;
    float radial = radius / max(boundary, 0.0001);

    // Outside the film entirely — nothing to draw.
    if (radial > 1.08) discard;

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(uLightDir);

    // Slow-drifting patchiness: two sine fields at different scales,
    // multiplied, so film thickness varies organically instead of reading
    // as one flat fill.
    float drift = uTime * 0.06;
    float film =
      sin(vLocal.x * 1.15 + vLocal.y * 0.9 + drift) *
      sin(vLocal.x * 0.62 - vLocal.y * 1.45 - drift * 0.7);
    float filmN = film * 0.5 + 0.5;
    float fine = sin(vLocal.x * 3.6 - vLocal.y * 2.8 + drift * 1.6) * 0.5 + 0.5;

    // Crude: near-black, with slightly thinner blue-black patches.
    vec3 color = mix(uBaseColor, uBaseColor * 1.9, filmN * 0.6 + fine * 0.18);

    // Thin-film iridescence — restrained, and only at grazing angles where
    // a real sheen actually catches light. Two tones, not a rainbow.
    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.4);
    vec3 sheen = mix(uSheenA, uSheenB, smoothstep(0.25, 0.85, fine));
    color = mix(color, sheen, fresnel * 0.72);

    // Oil damps capillary ripples, so the film is glassier than the water
    // around it: one tight, dim highlight rather than the ocean's sparkle.
    vec3 halfVector = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfVector), 0.0), 90.0) * 0.9;
    color += vec3(0.66, 0.74, 0.82) * spec;

    // Perimeter sheen — the thin bright fringe where the film feathers out.
    float rim =
      smoothstep(0.86, 0.985, radial) * (1.0 - smoothstep(0.985, 1.04, radial));
    color += rim * vec3(0.42, 0.58, 0.64);

    float edgeAlpha = 1.0 - smoothstep(0.9, 1.06, radial);
    float alpha = uOpacity * edgeAlpha * mix(0.5, 0.86, filmN);

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Oil on water — an analytical visualisation of a *potential* slick, never a
 * claim of confirmed oil. Conforms to the ocean's own wave field, with
 * patchy thickness, a feathered boundary, a perimeter sheen, and restrained
 * iridescence. Spreads slightly as the narrative moves through the stage.
 */
export function OilSlick({
  progressRef,
  weight = 1,
}: {
  progressRef: RefObject<number>;
  weight?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(PATCH_WIDTH, PATCH_DEPTH, 96, 96);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWorldOffset: {
        value: new THREE.Vector2(SLICK_ORIGIN[0], SLICK_ORIGIN[2]),
      },
      uBaseRadius: { value: BASE_RADIUS },
      uSpread: { value: 0.8 },
      uBaseColor: { value: new THREE.Color("#141b26") },
      uSheenA: { value: new THREE.Color("#27707d") },
      uSheenB: { value: new THREE.Color("#3c3566") },
      uLightDir: { value: MOON_DIRECTION.clone() },
      uOpacity: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    const progress = progressRef.current;
    const opacity = stageOpacity(progress, SLICK_STAGE.range, 0.05, true);

    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uOpacity.value = opacity * weight;
      // Spreads as the investigation moves through the stage and after.
      const growth = smoothstep(
        (progress - SLICK_STAGE.range[0]) /
          (SLICK_STAGE.range[1] - SLICK_STAGE.range[0])
      );
      u.uSpread.value = 0.8 + growth * 0.24;
    }

    if (groupRef.current) {
      groupRef.current.visible = opacity > 0.01;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[SLICK_ORIGIN[0], SLICK_ORIGIN[1], SLICK_ORIGIN[2]]}
      visible={false}
    >
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={SLICK_VERTEX}
          fragmentShader={SLICK_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
