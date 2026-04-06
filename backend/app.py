"""
app.py — FastAPI entrypoint
============================
Automatically discovers and mounts all routers from the routes/ folder.
Each file in routes/ must expose a `router` object (APIRouter).

Usage:
    uvicorn app:app --reload --port 8000
"""

import importlib
import pkgutil
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Hackniche Traceability API",
    description="Intelligent Traceability Management System for Recycled Materials",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# NOTE: allow_credentials=True is incompatible with allow_origins=["*"].
# We list explicit origins + regexes to cover ngrok and Vercel deployments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "https://mostly-unbiased-ladybird.ngrok-free.app",
        "https://eas-scanner.vercel.app",
    ],
    allow_origin_regex=r"https://(.*\.ngrok(-free)?\.app|.*\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auto-discover and mount all routers from routes/ ──────────────────────────
ROUTES_DIR = Path(__file__).parent / "routes"

def _load_routes():
    """
    Walk every .py file in routes/, import it, and mount its `router` on the app.
    Router prefix is taken from `router.prefix` if set, otherwise defaults to
    /api/<module_name>.
    """
    if not ROUTES_DIR.exists():
        print("[app] Warning: routes/ directory not found — no routes loaded.")
        return

    for module_info in pkgutil.iter_modules([str(ROUTES_DIR)]):
        module_name = module_info.name
        if module_name.startswith("_"):
            continue  # skip __init__.py etc.

        full_module = f"routes.{module_name}"
        try:
            module = importlib.import_module(full_module)
        except Exception as e:
            print(f"[app] Failed to import {full_module}: {e}")
            continue

        router = getattr(module, "router", None)
        if router is None:
            print(f"[app] Skipping {full_module}: no `router` found.")
            continue

        app.include_router(router)
        prefix = getattr(router, "prefix", f"/api/{module_name}")
        print(f"[app] ✅ Mounted router: {full_module} → {prefix}")


_load_routes()


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "message": "Hackniche Traceability API is running."}


# ── Static Files (QR Codes) ──────────────────────────────────────────────────────
# Ensure qr_codes directory exists before mounting
QR_DIR = Path(__file__).parent / "qr_codes"
if not QR_DIR.exists():
    QR_DIR.mkdir()

app.mount("/api/qr", StaticFiles(directory=str(QR_DIR)), name="qr_codes")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
