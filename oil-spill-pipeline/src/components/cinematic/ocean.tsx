"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MOON_DIRECTION } from "@/components/cinematic/night-sky";

/**
 * Wave parameters, mirrored in plain JS so scene elements (drift markers,
 * AIS vessels, rule-out markers) can sample sea height at a point and float
 * on the surface. Must stay in sync with WAVE_GLSL below.
 */
const WAVES = [
  { dir: [0.857, 0.514], freq: 0.055, amp: 0.78, speed: 0.34 },
  { dir: [-0.447, 0.894], freq: 0.135, amp: 0.4, speed: 0.55 },
  { dir: [0.936, -0.351], freq: 0.32, amp: 0.17, speed: 0.95 },
  { dir: [-0.914, -0.406], freq: 0.86, amp: 0.06, speed: 1.6 },
] as const;

export const MAX_WAVE_AMPLITUDE = WAVES.reduce((sum, w) => sum + w.amp, 0);

export function getOceanHeight(x: number, z: number, time: number): number {
  let height = 0;
  for (const wave of WAVES) {
    height +=
      wave.amp *
      Math.sin((x * wave.dir[0] + z * wave.dir[1]) * wave.freq + time * wave.speed);
  }
  return height;
}

/**
 * Shared wave math, injected into both the ocean's and the slick's vertex
 * shaders so the slick deforms with exactly the same surface it floats on.
 * Four scales: a large rolling swell, a medium wave, a short wave, and a
 * fine ripple. Normals come from the analytic derivative, not a sampled
 * normal map, so there's no extra texture or pass.
 */
export const WAVE_GLSL = /* glsl */ `
  const vec2 dir0 = vec2(0.857, 0.514);
  const vec2 dir1 = vec2(-0.447, 0.894);
  const vec2 dir2 = vec2(0.936, -0.351);
  const vec2 dir3 = vec2(-0.914, -0.406);

  const float freq0 = 0.055;
  const float freq1 = 0.135;
  const float freq2 = 0.32;
  const float freq3 = 0.86;

  const float amp0 = 0.78;
  const float amp1 = 0.4;
  const float amp2 = 0.17;
  const float amp3 = 0.06;

  const float speed0 = 0.34;
  const float speed1 = 0.55;
  const float speed2 = 0.95;
  const float speed3 = 1.6;

  float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += amp0 * sin(dot(p, dir0) * freq0 + t * speed0);
    h += amp1 * sin(dot(p, dir1) * freq1 + t * speed1);
    h += amp2 * sin(dot(p, dir2) * freq2 + t * speed2);
    h += amp3 * sin(dot(p, dir3) * freq3 + t * speed3);
    return h;
  }

  vec2 waveSlope(vec2 p, float t) {
    float dx = 0.0;
    float dz = 0.0;
    float c0 = amp0 * freq0 * cos(dot(p, dir0) * freq0 + t * speed0);
    dx += c0 * dir0.x; dz += c0 * dir0.y;
    float c1 = amp1 * freq1 * cos(dot(p, dir1) * freq1 + t * speed1);
    dx += c1 * dir1.x; dz += c1 * dir1.y;
    float c2 = amp2 * freq2 * cos(dot(p, dir2) * freq2 + t * speed2);
    dx += c2 * dir2.x; dz += c2 * dir2.y;
    float c3 = amp3 * freq3 * cos(dot(p, dir3) * freq3 + t * speed3);
    dx += c3 * dir3.x; dz += c3 * dir3.y;
    return vec2(dx, dz);
  }
`;

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vDetail;

  ${WAVE_GLSL}

  void main() {
    vec3 pos = position;
    vec2 slope = waveSlope(pos.xz, uTime);
    float height = waveHeight(pos.xz, uTime);
    pos.y += height;

    vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vHeight = height;

    // Two higher-frequency phases multiplied together — deliberately not
    // periodic-looking — used to scatter the tight specular into separate
    // twinkling facets rather than one smooth glossy blob.
    vDetail =
      sin(dot(pos.xz, dir2) * freq2 * 2.3 + uTime * speed2 * 1.6 + 1.3) *
      sin(dot(pos.xz, dir3) * freq3 * 1.7 - uTime * speed3 * 1.1);

    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uMidColor;
  uniform vec3 uCrestColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uMoonColor;
  uniform vec3 uLightDir;
  uniform float uMaxAmplitude;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vDetail;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(uLightDir);

    // Three-tone gradient across the FULL height range rather than a single
    // deep->crest mix biased at the peaks. Every part of a wave — trough,
    // flank, ridge — lands on a different tone, so the swell structure reads
    // immediately instead of most of the surface crushing to black.
    float heightN = clamp(vHeight / uMaxAmplitude * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(uDeepColor, uMidColor, smoothstep(0.05, 0.52, heightN));
    base = mix(base, uCrestColor, smoothstep(0.5, 0.88, heightN));

    float diffuse = max(dot(normal, lightDir), 0.0);
    base = mix(base, base * 1.5 + vec3(0.015, 0.025, 0.035), diffuse * 0.6);

    // Broad moonlit sheen — a wide, soft reflection path across the water...
    vec3 halfVector = normalize(lightDir + viewDir);
    float ndoth = max(dot(normal, halfVector), 0.0);
    float broadSpec = pow(ndoth, 9.0) * 0.22;

    // ...plus a tight sparkle broken up by the detail phase, which is what
    // reads as individual wave facets catching the moon.
    float sparkle = 0.5 + 0.5 * smoothstep(0.15, 1.0, vDetail);
    float tightSpec = pow(ndoth, 70.0) * 0.7 * sparkle;

    // Attenuate the glitter close to camera, otherwise the near field
    // blows out to a white wash instead of reading as water.
    float dist = length(cameraPosition - vWorldPosition);
    float nearFalloff = smoothstep(6.0, 34.0, dist);
    vec3 specularColor = uMoonColor * (broadSpec + tightSpec) * nearFalloff;

    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);
    vec3 rimColor = vec3(0.13, 0.2, 0.26) * fresnel * 0.55;

    float foam = smoothstep(0.62, 0.93, heightN) * 0.2;
    vec3 foamColor = vec3(0.62, 0.7, 0.76) * foam;

    vec3 color = base + specularColor + rimColor + foamColor;

    // Distance haze toward the horizon tone — separates water from sky and
    // saturates well before the plane's edge, so the edge never shows.
    float horizonMix = smoothstep(70.0, 290.0, dist) * 0.6;
    color = mix(color, uHorizonColor, horizonMix);

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface OceanProps {
  size?: number;
  segments?: number;
}

export function Ocean({ size = 520, segments = 200 }: OceanProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [size, segments]);

  // Manually-constructed geometry isn't auto-disposed by R3F (only
  // JSX-declared elements are) — free the GPU buffers on unmount/rebuild.
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color("#060d16") },
      uMidColor: { value: new THREE.Color("#0f2637") },
      uCrestColor: { value: new THREE.Color("#204e66") },
      uHorizonColor: { value: new THREE.Color("#132b3c") },
      uMoonColor: { value: new THREE.Color("#cfe0ec") },
      // Same direction the moon is actually drawn in, so the reflection
      // path on the water lines up with the visible moon.
      uLightDir: { value: MOON_DIRECTION.clone() },
      uMaxAmplitude: { value: MAX_WAVE_AMPLITUDE },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </mesh>
  );
}
