# Deployment Guide

This guide provides step-by-step instructions for deploying your RecycleIT project: the frontend to Vercel and the backend to Render using `uv` (no `pip install` required).

## Prerequisites
- Push this repository to a Git provider (GitHub, GitLab, Bitbucket).

---

## 1. Backend Deployment (Render)

The backend is built with FastAPI and runs with `uvicorn`. We use `uv` for dependency management. Since Render Blueprints are a paid feature, we will manually create a Web Service for free.

### Step-by-step using Render Dashboard:
1. Log into your Render account at [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your Git repository.
4. Configure the following fields:
   - **Name:** recycleit-backend
   - **Region:** (Choose closest to you)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python`
   - **Build Command:** `curl -LsSf https://astral.sh/uv/install.sh | sh && ~/.local/bin/uv sync`
   - **Start Command:** `.venv/bin/uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Expand **Advanced** and add the following Environment Variable:
   - Key: `PYTHON_VERSION`, Value: `3.13.0`
6. Click **Create Web Service**.

**Environment Variables**
Once deployed, remember to add any necessary environment variables (like Database URLs, API keys) in the Render dashboard under your service's "Environment" tab.

---

## 2. Frontend Deployment (Vercel)

The frontend is a Next.js application located in the `frontend` directory. Vercel naturally supports Next.js with zero configuration.

### Step-by-step using Vercel Dashboard:
1. Log into your Vercel account at [vercel.com](https://vercel.com).
2. Click **Add New...** and select **Project**.
3. Import your Git repository where RecycleIT is hosted.
4. Under the **Configure Project** section:
   - **Framework Preset:** Next.js (should be auto-detected).
   - **Root Directory:** Click "Edit" and select `frontend`.
5. Expand the **Environment Variables** section:
   - Add any environment variables your frontend requires (e.g., `NEXT_PUBLIC_API_URL` pointing to your new Render backend URL).
6. Click **Deploy**.

Vercel will handle the `npm run build` and deployment process automatically. Once finished, you will receive a public URL to access your web application.
