# Frontend Refactor — React + TypeScript + Vite

This document describes the transition of the JunctionX-Delft project
from Django-rendered templates to a modern **React + TypeScript**
single-page application built with **Vite**.

The backend remains Django + Django REST Framework (DRF), but the UI is
now a self-contained frontend that communicates with the API through
JSON endpoints.

---

## 🎯 Goals

- Replace Django templates, JS, and jQuery logic with a modern React app.
- Keep the existing backend logic fully intact (no business-logic changes).
- Enable hot-reloading, TypeScript type-safety, and reusable components.
- Preserve session-based ownership for anonymous users through the API.
- Package everything under Docker for consistent local development.

---

## 🧩 Structure Overview

```
frontend/
├── index.html               # Vite entry HTML (root for dev + build)
├── vite.config.ts           # Dev server + proxy configuration
├── tsconfig.json            # TypeScript setup
├── package.json             # React, Vite, and tooling dependencies
├── src/
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Root component / router host
│   ├── components/          # UI components
│   │   ├── UploadPage.tsx   # Main page with upload form + jobs table
│   │   ├── JobsTable.tsx    # Table displaying queued and finished jobs
│   │   ├── JobModal.tsx     # Transcript detail modal
│   │   ├── ThemeToggle.tsx  # Light/dark toggle
│   │   └── Toasts.tsx       # Toast notifications (auto-disappearing)
│   ├── lib/                 # Frontend utilities
│   │   ├── api.ts           # API wrappers around /api/ endpoints
│   │   ├── cache.ts         # LocalStorage persistence for job sizes
│   │   ├── csrf.ts          # CSRF token bootstrap
│   │   ├── types.ts         # Shared TypeScript types
│   │   └── utils.ts         # Helpers (formatting, clipboard, etc.)
│   └── assets/css/          # Bootstrap + custom CSS
│       ├── app.css
│       ├── upload.css
│       └── job_detail.css
```

---

## ⚙️ Development Setup

### 🐳 Running via Docker (recommended)

The `frontend` service runs on **Node 20-alpine** and uses hot-reloading via Vite.
It is already included in `docker-compose.yml`.

Run everything together:

```bash
docker compose up --build
```

- Django backend → http://localhost:8000  
- React/Vite frontend → http://localhost:5173

---

### 🖥️ Running locally (without Docker)

If you prefer, install Node 20+ and run directly:

```bash
cd frontend
npm install
npm run dev
```

---

## 🧠 Key Improvements

| Feature | Old Django Templates | New React/Vite Implementation |
|----------|----------------------|-------------------------------|
| Rendering | HTML templates rendered server-side | React components rendered client-side |
| JS logic | Inline scripts (`upload_bulk.js`, etc.) | Modular TypeScript + React hooks |
| CSS | Static Bootstrap files | Modular CSS imported per component |
| Job updates | Manual polling + jQuery DOM updates | React polling via hooks + API caching |
| Toasts | Alerts appended to DOM | Reusable toast system with auto-dismiss |
| File size cache | Lost on refresh | Persisted via `localStorage` |
| Theme toggle | None | Dark/light mode toggle using Bootstrap 5 themes |

---

## 🔮 Future Enhancements

- Add React Router for multiple pages (dashboard, settings, etc.).
- Integrate a component library (shadcn/ui or MUI) for consistent design.
- Replace background thread polling with WebSockets for live updates.
- Convert inline CSS to a unified design system (Tailwind or SCSS modules).

---

_Refactor completed by **Vlad Păun**, October 2025._
