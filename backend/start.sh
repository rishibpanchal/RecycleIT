#!/usr/bin/env bash
# Start script for Render / generic hosts
exec uv run uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
