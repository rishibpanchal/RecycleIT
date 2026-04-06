"""
routes/health.py
==================
Simple health-check and server info endpoint.

Endpoints:
  GET /api/health        → server status
  GET /api/health/db     → check SQLite database exists
"""

import os
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/health", tags=["health"])

ROOT_DIR = Path(__file__).parent.parent.parent


@router.get("")
def health():
    """Server liveness check."""
    return {
        "status": "ok",
        "service": "Hackniche Traceability API",
        "version": "1.0.0",
    }


@router.get("/db")
def db_health():
    """Check that the SQLite database exists and has content."""
    db_path = ROOT_DIR / "traceability.db"
    if not db_path.exists():
        return {"status": "missing", "detail": "traceability.db not found. Run grapher.py first."}
    size_kb = round(db_path.stat().st_size / 1024, 1)
    return {"status": "ok", "path": str(db_path), "size_kb": size_kb}
