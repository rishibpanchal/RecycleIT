DEPLOYMENT
==========

This document explains how to deploy the project frontend to Vercel and the backend to Render.

Prerequisites
- Push this repository to a Git provider (GitHub, GitLab, Bitbucket).
- For backend: a Python runtime (3.11+ recommended).
- For frontend: Node 18+ (Vercel supplies this automatically).

Frontend (Vercel)
- The frontend is a Next.js app in the `frontend/` folder.
- Steps:
  1. In Vercel, import the repository and select the `frontend/` root as the project path.
  2. Build command: `npm run build` (or `yarn build`).
  3. Output directory: default for Next.js (Vercel auto-detects).
  4. Set any required environment variables in the Vercel dashboard (e.g., `NEXT_PUBLIC_API_URL` pointing to your backend URL).

Backend (Render)
- The backend is a FastAPI app in `backend/` with entry `app.py`.
- Files added to help deployment:
  - `backend/requirements.txt` — lists Python packages for pip install.
  - `backend/start.sh` — simple start script that runs `uvicorn app:app` using `$PORT`.
- Steps:
  1. In Render, create a new Web Service and connect your Git repo.
  2. Set the Root to `backend` (or deploy the entire repo and set the Start command to `./start.sh`).
  3. Runtime: choose Python 3.11 (or newer).
  4. Build command: leave blank (Render will run `pip install -r requirements.txt`). If you prefer, set the Start Command to `./start.sh`.
  5. Add environment variables via Render dashboard (examples: `DATABASE_URL`, `OPENAI_API_KEY`, etc.).

Notes & Caveats
- `pyproject.toml` required Python version was lowered to `>=3.11` to be compatible with common hosting providers.
- If you need a specific database (Postgres, Redis, Neo4j), provision it separately on Render or another provider and set the connection URL in env vars.
- If you want CI/CD automation, render.yaml (Render Blueprint) can be added — I can create one if you want.

Next steps I can do for you
- Create a `render.yaml` with service definitions.
- Create GitHub Actions to deploy on push.
- Set up example environment variables and a simple health-check URL.
