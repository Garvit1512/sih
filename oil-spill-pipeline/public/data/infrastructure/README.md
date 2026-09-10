# Infrastructure geometry (map display only)

`platforms.geojson` and `pipelines.geojson` are copies of the repository's
hand-verified static infrastructure dataset (`../../../../data/infrastructure/`,
provenance documented in `data/README.md`). They are served as static assets so
the map can **draw** the feature the Stage B triage engine measured against.

They are display geometry only:

- Every distance, `nearby` flag, hypothesis and routing decision comes from the
  backend triage response. Nothing on the map is recomputed client-side.
- A feature is drawn only when the backend's triage evidence names its `id`, so
  the map cannot show infrastructure the engine did not actually consider.

They exist here because `InfrastructureEvidence.location` is null for pipelines
— the nearest point on a line is not part of the frozen Stage B contract — so
the line itself has no other source on the client. If the dataset in
`data/infrastructure/` changes, re-copy both files.
