"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { CAMERA_KEYFRAMES } from "@/components/cinematic/stages";
import { smoothstep } from "@/components/cinematic/cinematic-math";

function sampleCameraPath(progress: number) {
  const frames = CAMERA_KEYFRAMES;
  let i = 0;
  while (i < frames.length - 2 && progress > frames[i + 1].t) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const span = b.t - a.t || 1;
  const localT = smoothstep((progress - a.t) / span);

  const position = new THREE.Vector3(...a.position).lerp(
    new THREE.Vector3(...b.position),
    localT
  );
  const lookAt = new THREE.Vector3(...a.lookAt).lerp(
    new THREE.Vector3(...b.lookAt),
    localT
  );
  const fov = THREE.MathUtils.lerp(a.fov, b.fov, localT);

  return { position, lookAt, fov };
}

interface CinematicCameraProps {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}

/**
 * Scroll-driven camera rig. Reads scroll progress from a ref (kept in sync
 * via a MotionValue subscription, not React state) so it can smoothly
 * interpolate every frame without re-rendering. Cursor parallax is damped
 * separately and stays subtle. Under reduced motion, camera movement is
 * clamped to near the opening frame and parallax is disabled.
 */
export function CinematicCamera({
  scrollYProgress,
  reducedMotion,
}: CinematicCameraProps) {
  const { camera, pointer } = useThree();
  const progressRef = useRef(0);
  const parallax = useRef(new THREE.Vector2(0, 0));
  const currentLookAt = useRef(
    new THREE.Vector3(...CAMERA_KEYFRAMES[0].lookAt)
  );

  useEffect(() => {
    progressRef.current = scrollYProgress.get();
    const unsubscribe = scrollYProgress.on("change", (value) => {
      progressRef.current = value;
    });
    return unsubscribe;
  }, [scrollYProgress]);

  useEffect(() => {
    const start = CAMERA_KEYFRAMES[0];
    camera.position.set(...start.position);
    currentLookAt.current.set(...start.lookAt);
    camera.lookAt(currentLookAt.current);
  }, [camera]);

  // react-hooks/immutability doesn't recognize `useFrame` (an R3F hook, not
  // React's own) as a side-effect context, so it flags mutating the camera
  // returned by `useThree()`. Imperatively mutating the live THREE.Camera
  // instance every frame, outside React's render cycle, is the documented
  // R3F pattern for driving a camera rig — there's no non-mutating
  // alternative to moving a Three.js object.
  /* eslint-disable react-hooks/immutability -- see note above */
  useFrame((_, delta) => {
    const target = sampleCameraPath(progressRef.current);

    if (reducedMotion) {
      parallax.current.set(0, 0);
    } else {
      parallax.current.x = THREE.MathUtils.damp(
        parallax.current.x,
        pointer.x,
        3,
        delta
      );
      parallax.current.y = THREE.MathUtils.damp(
        parallax.current.y,
        pointer.y,
        3,
        delta
      );
    }

    // Reduced motion: stay close to the opening frame instead of following
    // the full scroll-driven path, per oil-spill-pipeline/CLAUDE.md §19.
    const basePosition = reducedMotion
      ? new THREE.Vector3(...CAMERA_KEYFRAMES[0].position).lerp(
          target.position,
          0.15
        )
      : target.position;

    const targetPosition = basePosition
      .clone()
      .add(
        new THREE.Vector3(parallax.current.x * 0.5, parallax.current.y * 0.25, 0)
      );

    const lambda = reducedMotion ? 1.4 : 2.2;
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      targetPosition.x,
      lambda,
      delta
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      targetPosition.y,
      lambda,
      delta
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetPosition.z,
      lambda,
      delta
    );

    const baseLookAt = reducedMotion
      ? new THREE.Vector3(...CAMERA_KEYFRAMES[0].lookAt)
      : target.lookAt;
    const targetLookAt = baseLookAt
      .clone()
      .add(
        new THREE.Vector3(parallax.current.x * 0.8, parallax.current.y * 0.4, 0)
      );

    currentLookAt.current.x = THREE.MathUtils.damp(
      currentLookAt.current.x,
      targetLookAt.x,
      lambda,
      delta
    );
    currentLookAt.current.y = THREE.MathUtils.damp(
      currentLookAt.current.y,
      targetLookAt.y,
      lambda,
      delta
    );
    currentLookAt.current.z = THREE.MathUtils.damp(
      currentLookAt.current.z,
      targetLookAt.z,
      lambda,
      delta
    );

    camera.lookAt(currentLookAt.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = reducedMotion ? CAMERA_KEYFRAMES[0].fov : target.fov;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, lambda, delta);
      camera.updateProjectionMatrix();
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
