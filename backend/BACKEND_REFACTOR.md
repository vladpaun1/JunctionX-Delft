# Backend Refactor — Django REST API Integration for React Frontend

This document summarizes the backend refactoring work
that modernized the Django codebase to cleanly support
a standalone React/Vite frontend.

---

## 🧭 Overview

The backend still uses **Django 5.2 + Django REST Framework (DRF)**,  
but its role has shifted from serving HTML templates to
providing a clean, versioned JSON API.

All UI rendering logic, templates, and JavaScript files
from `apps/web` were removed or replaced.

---

## 🧩 Key Architecture Changes

### 1. Unified API Layer

- Introduced a single **`UploadJobViewSet`** (`apps/api/viewsets.py`)
  that consolidates:
  - listing, retrieving, deleting jobs  
  - enqueuing multiple uploads  
  - exporting and retrieving transcripts

- Added `apps/api/serializers.py` for clean DRF serialization.

- Object-level permissions handled by
  `IsOwnerByPrincipal`, which maps ownership to either:
  - `request.user` (authenticated)
  - `session_key` (anonymous browser sessions)

---

### 2. Updated API Endpoints

| Method | Endpoint | Purpose |
|--------|-----------|----------|
| `GET` | `/api/ping/` | Health check |
| `GET` | `/api/jobs/` | List user/session jobs |
| `POST` | `/api/jobs/bulk/` | Upload & enqueue multiple files |
| `GET` | `/api/jobs/<uuid>/` | Retrieve job details |
| `DELETE` | `/api/jobs/<uuid>/` | Delete job and associated files |
| `GET` | `/api/jobs/<uuid>/data/` | Return transcript JSON for display |
| `GET` | `/api/jobs/<uuid>/export/` | Download JSON export |
| `GET` | `/api/reset-session/` | Flush session + delete all owned jobs/files |

---

### 3. Background Processing

Each upload is analyzed asynchronously in a background thread:
- Input normalization → transcription (Vosk/Whisper) → labeling.
- Progress tracked via `UploadJob.status` (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`).
- Results and metadata persisted in the database.

---

### 4. File Cleanup

When a job is deleted (via API or reset-session):
- The original upload (in `/media/uploads/`)
- The normalized audio (in `/media/normalized/`)
- The transcript JSON (in `/media/transcripts/<id>.json`)
are all deleted best-effort via `_safe_rm()`.

This ensures no orphaned files remain after deletions.

---

### 5. Simplified Django URLs

**Old:**
```
core/urls.py → included web.urls + api.urls
apps/web/urls.py → mixed templates and APIs
```

**New:**
```
core/urls.py → only admin + /api/
apps/api/urls.py → DRF router + standalone APIViews
```

No templates are served by Django anymore.  
In production, the React build in `frontend/dist/`
will serve as the web entry point.

---

### 6. Session Reset Endpoint

`ResetSessionView` allows anonymous users to:
- Clear their Django session,
- Delete all their jobs,
- Remove any uploaded or generated files.

This is useful for local demos or shared environments.

---

## 🗂️ Files and Modules

| Path | Purpose |
|------|----------|
| `apps/api/viewsets.py` | Core REST endpoints for jobs |
| `apps/api/serializers.py` | DRF serialization for UploadJob |
| `apps/api/utils.py` | Shared helpers for file paths and ownership |
| `apps/api/views.py` | Simple APIViews (Ping, ResetSession) |
| `apps/web/models.py` | Contains the UploadJob model |
| `core/urls.py` | Global routing (admin + api) |

---

## 🧹 Cleanup Work

- Removed all template rendering (UploadView, JobDetailPage).
- Deleted legacy JS (upload_bulk.js, job_detail.js, etc.).
- Removed `apps/web/templates/` and `static/` directories.
- DRF now handles all data serialization and validation.
- Added `django-cors-headers` for proxy compatibility with Vite.
- Added `frontend/dist` to `STATICFILES_DIRS` for production builds.

---

## ⚙️ Development & Testing

- **Dev:** Django runs on port 8000; React dev server proxies `/api/*` calls.
- **Test:** You can use DRF’s built-in API browser or Swagger docs at `/api/docs/`.
- **Session-based ownership:** Jobs persist across page reloads until `reset-session`.

---

## 🔮 Future Steps

- Add token or cookie authentication for persistent accounts.
- Implement proper job pagination and filtering.
- Add background job queue (Celery/RQ) instead of threads for scalability.
- Migrate media cleanup to async tasks.

---

_Refactor implemented by **Vlad Păun**, October 2025._
