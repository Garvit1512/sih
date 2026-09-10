"""Real (non-mock) upstream stage providers.

Each module here adapts a teammate's real stage output to the frozen contract. The
adapters deliberately read precomputed case artifacts rather than invoking models
in-process: the API stays free of heavy ML dependencies, and the demo never waits on a
forward pass (see docs/staged-build-reference.md Stage 39, case artifact store).
"""
