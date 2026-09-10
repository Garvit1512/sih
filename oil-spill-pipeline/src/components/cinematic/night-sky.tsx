"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const STAR_COUNT = 2600;
const STAR_RADIUS = 210;

/** Moon direction — the ocean shader's uLightDir points at this same spot. */
export const MOON_DIRECTION = new THREE.Vector3(-0.34, 0.15, -0.93).normalize();
export const MOON_DISTANCE = 190;
export const MOON_POSITION = MOON_DIRECTION.clone().multiplyScalar(MOON_DISTANCE);

/**
 * Deterministic PRNG so the sky is identical on every load and between
 * server and client — no hydration drift, no reshuffling on HMR.
 */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aTint;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vBrightness;
  varying float vTint;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Atmospheric extinction — stars thin out and dim toward the horizon
    // rather than running straight into the sea.
    float elevation = normalize(position).y;
    float horizonFade = smoothstep(0.005, 0.22, elevation);

    // Slow twinkle, phase-shifted per star.
    float twinkle = 0.86 + 0.14 * sin(uTime * 1.1 + aTint * 47.0);

    vBrightness = aBrightness * horizonFade * twinkle;
    vTint = aTint;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying float vBrightness;
  varying float vTint;

  void main() {
    // Soft round falloff — a point sprite, not a hard square pixel.
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.04, d) * vBrightness;

    // Restrained stellar colour: cool white through to faintly warm white.
    vec3 cool = vec3(0.76, 0.85, 1.0);
    vec3 warm = vec3(1.0, 0.93, 0.84);
    vec3 color = mix(cool, warm, vTint * 0.55);

    gl_FragColor = vec4(color, alpha);
  }
`;

function Starfield() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();

  const geometry = useMemo(() => {
    const random = makeRandom(20260910);
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const brightness = new Float32Array(STAR_COUNT);
    const tints = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const azimuth = random() * Math.PI * 2;
      // Bias toward lower elevations so the sky doesn't pool at the zenith.
      const elevation = Math.asin(0.015 + Math.pow(random(), 1.35) * 0.985);
      const cosE = Math.cos(elevation);

      // Stars sit at varied depths rather than on one shell, so the camera's
      // own travel produces genuine parallax between near and far stars —
      // no faked parallax layers needed.
      const radius = STAR_RADIUS * (0.62 + random() * 0.38);

      positions[i * 3] = Math.cos(azimuth) * cosE * radius;
      positions[i * 3 + 1] = Math.sin(elevation) * radius;
      positions[i * 3 + 2] = Math.sin(azimuth) * cosE * radius;

      // Mostly faint, a few notably bright — a power curve, not uniform,
      // which is what stops it reading as scattered identical white dots.
      sizes[i] = 1.15 + Math.pow(random(), 3.0) * 4.2;
      brightness[i] = 0.4 + Math.pow(random(), 1.7) * 0.6;
      tints[i] = random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 1));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uPixelRatio.value = Math.min(
        viewport.dpr ?? 1,
        2
      );
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const GLOW_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;

  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    // Two-stage falloff: a tight inner halo inside a much wider, fainter one.
    float inner = pow(1.0 - clamp(d, 0.0, 1.0), 4.0);
    float outer = pow(1.0 - clamp(d, 0.0, 1.0), 1.6) * 0.35;
    gl_FragColor = vec4(uColor, (inner + outer) * uIntensity);
  }
`;

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Moon disc plus a soft halo, billboarded toward the camera. */
function Moon() {
  const glowRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const glowUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#b9cfe4") },
      uIntensity: { value: 0.62 },
    }),
    []
  );

  useFrame(() => {
    glowRef.current?.lookAt(camera.position);
  });

  return (
    <group position={MOON_POSITION}>
      <mesh ref={glowRef}>
        <planeGeometry args={[46, 46]} />
        <shaderMaterial
          vertexShader={GLOW_VERTEX}
          fragmentShader={GLOW_FRAGMENT}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[3, 24, 24]} />
        <meshBasicMaterial color="#e8f0f7" fog={false} />
      </mesh>
    </group>
  );
}

/**
 * Earth's night sky over open water: a dense but restrained starfield with
 * horizon extinction, and a small low moon whose direction matches the
 * ocean shader's specular path. No nebulae, no colour washes.
 */
export function NightSky() {
  return (
    <group>
      <Starfield />
      <Moon />
    </group>
  );
}
