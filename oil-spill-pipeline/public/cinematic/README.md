# Cinematic environment plates

Drop the Higgsfield-generated video plates here. Until they exist, the page
falls back to the procedural Three.js environment automatically — nothing
breaks, and no placeholder footage is committed.

| File | Scroll range | Beat |
| --- | --- | --- |
| `hero.mp4` | 0.00 – 0.15 | Night ocean, establishing |
| `sar.mp4` | 0.15 – 0.42 | Acquisition / detection |
| `slick.mp4` | 0.42 – 0.70 | Rule-out / backward drift |
| `ais.mp4` | 0.70 – 1.00 | Lineup / overview |

Wire additional or differently-named plates by passing a `clips` array to
`CinematicVideoBackground` instead of the default export.

## Content rules

Plates are an **environment layer only**. They must contain no text, UI,
labels, confidence figures, tracks, markers or any other analytical
content — all of that is rendered live in the React/Three.js layers above,
so it stays truthful, inspectable, and never baked into footage.

## Encoding

- H.264 MP4, `faststart` (moov atom at the front) so metadata loads first.
- Keep them **short and densely keyframed** — the page scrubs `currentTime`
  from scroll position, and sparse keyframes make seeking visibly laggy.
  A keyframe interval of ~0.2s (roughly every 5 frames) scrubs smoothly.
- Aim for ≤ 1080p and a few MB per plate; these load on first paint.
- No audio track (the elements are muted regardless).
