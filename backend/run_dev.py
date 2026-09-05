"""Dev-server entrypoint used by .claude/launch.json.

uvicorn's CLI has no --port-from-env option, so a hardcoded --port flag defeats
the harness's auto-port assignment (it needs to pick the port and hand it to us
via the PORT environment variable). This wrapper reads PORT at startup instead.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make "app.main:app" resolvable regardless of the caller's cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn  # noqa: E402

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    backend_dir = str(Path(__file__).resolve().parent)
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        reload_dirs=[backend_dir],
    )
