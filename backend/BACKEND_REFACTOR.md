# Backend Refactor Summary — Django → DRF API + React/Vite Integration

## Overview

This refactor converts the backend into a clean Django REST Framework (DRF) API,
preparing it for a React + Vite + TypeScript frontend.  
The previous Django‐template views and ad-hoc API endpoints were consolidated into
modern DRF viewsets and serializers.

---

## Main Changes

### 🧩 Architecture

- **API Layer**
  - Replaced legacy `APIView` classes (`JobsView`, `JobDetailView`, etc.) with
    a single `UploadJobViewSet` (`apps/api/viewsets.py`).
  - Introduced DRF serializers (`apps/api/serializers.py`) to define
    how `UploadJob` objects are converted to JSON.
  - Added object-level permissions (`IsOwnerByPrincipal`) to enforce ownership
    based on `request.user` or `session_key`.
  - Moved helper logic to `apps/api/utils.py` for normalization, file paths, etc.
  - Routing handled via DRF’s `DefaultRouter` in `apps/api/urls.py`.

- **API Endpoints**
  ```
  GET    /api/ping/              → Health check
  GET    /api/jobs/              → List current user's jobs (paginated)
  POST   /api/jobs/bulk/         → Upload and enqueue multiple files
  GET    /api/jobs/<id>/         → Job detail
  DELETE /api/jobs/<id>/         → Delete a job and its files
  GET    /api/jobs/<id>/data/    → JSON export for frontend display
  GET    /api/jobs/<id>/export/  → Download transcript JSON
  ```

- **Ownership Rules**
  - Authenticated users own jobs via `user_id`.
  - Anonymous visitors own jobs via `session_key`.

- **Background Processing**
  - Each upload spawns a background thread running the ASR analysis pipeline.
  - Job status fields (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`) update in place.

### 🗂 Django Configuration

- `apps/web` kept only as a data/domain app (models, management commands, etc.).
  Old templates and JS removed.
- `core/urls.py`:
  - Now includes only `api/` and `admin/` routes.
  - Adds a production catch-all route serving `frontend/dist/index.html` for the SPA.
- `settings.py`:
  - Added `frontend/dist` to `TEMPLATES` for the built React app.
  - Added `frontend/dist/assets` to `STATICFILES_DIRS`.
  - Enabled `django-cors-headers` for local development (`CORS_ALLOW_ALL_ORIGINS=True`).
  - Retained DRF + Spectacular for schema/docs.

### 🧹 Cleanup

- Removed redundant endpoints and duplicate logic.
- Deleted obsolete `apps/web/urls.py` entries.
- Removed old JS/CSS templates once React build takes over.
- Simplified `apps/api/views.py` to only include lightweight utilities
  like `PingView` (and optional `ASRHealthView`).

---

## Development Notes

- Local dev uses **Vite proxy** (`/api/* → http://localhost:8000`).
- `CORS_ALLOW_ALL_ORIGINS=True` only for dev; restrict in production.
- Run schema/docs locally at:
  ```
  /api/schema/  – raw OpenAPI schema (JSON)
  /api/docs/    – Swagger UI
  ```

---

## Stack Summary

| Component | Purpose |
|------------|----------|
| **Django** | Web framework & ORM |
| **Django REST Framework (DRF)** | JSON API serialization, routing, permissions |
| **drf-spectacular** | Auto-generated OpenAPI schema & Swagger docs |
| **django-cors-headers** | Enables cross-origin API calls from Vite dev server |
| **Vite + React + TypeScript** | SPA frontend (built into `/frontend/dist/`) |

---

## Next Steps

1. Implement React frontend using `/api` endpoints.
2. Add token or session authentication if needed.
3. Replace `CORS_ALLOW_ALL_ORIGINS` with explicit `CORS_ALLOWED_ORIGINS` for prod.
4. Optionally containerize backend + frontend via Docker.

---

_Refactor by Vlad Păun, October 2025_
