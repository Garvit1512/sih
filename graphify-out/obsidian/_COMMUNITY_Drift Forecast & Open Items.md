---
type: community
cohesion: 0.13
members: 24
---

# Drift Forecast & Open Items

**Cohesion:** 0.13 - loosely connected
**Members:** 24 nodes

## Members
- [[dot-__init__()]] - code - backend/app/core/errors.py
- [[AppError]] - code - backend/app/core/errors.py
- [[Base class for domain errors with a stable HTTP status and error type.]] - rationale - backend/app/core/errors.py
- [[Exception]] - code
- [[InvestigationNotFoundError]] - code - backend/app/core/errors.py
- [[JSONResponse]] - code
- [[Logger]] - code
- [[POST apireport{case_id} (PRD §29). Consumes an already-computed…]] - rationale - backend/app/api/report.py
- [[Raised when a Stage ACD response fails schema validation (PRD §51).]] - rationale - backend/app/core/errors.py
- [[Request]] - code
- [[Structured logging configuration (PRD §60). Every investigation-related log…]] - rationale - backend/app/core/logging.py
- [[Typed domain exceptions mapped to structured HTTP error envelopes (PRD…]] - rationale - backend/app/core/errors.py
- [[UpstreamContractError]] - code - backend/app/core/errors.py
- [[api__init__.py]] - code - backend/app/api/__init__.py
- [[apireport.py]] - code - backend/app/api/report.py
- [[app_error_handler()]] - code - backend/app/core/errors.py
- [[configure_logging()]] - code - backend/app/core/logging.py
- [[errors.py]] - code - backend/app/core/errors.py
- [[generate_report()]] - code - backend/app/api/report.py
- [[get_logger()]] - code - backend/app/core/logging.py
- [[logging.py]] - code - backend/app/core/logging.py
- [[main.py]] - code - backend/app/main.py
- [[post_5]] - code
- [[unhandled_error_handler()]] - code - backend/app/core/errors.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Drift_Forecast__Open_Items
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_Stage B Triage & Infrastructure]]
- 8 edges to [[_COMMUNITY_Investigation & Report Tests]]
- 4 edges to [[_COMMUNITY_Investigation API & Orchestration]]
- 1 edge to [[_COMMUNITY_Vessel Attribution & Synthetic AIS]]

## Top bridge nodes
- [[main.py]] - degree 16, connects to 4 communities
- [[errors.py]] - degree 14, connects to 2 communities
- [[apireport.py]] - degree 9, connects to 2 communities
- [[generate_report()]] - degree 5, connects to 2 communities
- [[AppError]] - degree 9, connects to 1 community