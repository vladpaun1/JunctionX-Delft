# Development Workflow

Whether you prefer containers or running everything on your host, the project now has a predictable setup that keeps the backend and frontend aligned.

## 1. Docker Compose

Prerequisites: Docker Desktop or the Docker Engine + Compose plugin.

```bash
docker compose up --build web frontend
```

What happens:

- `web` uses the main `Dockerfile` but installs `requirements/dev.txt` (linting + training extras) via a build arg. Your repository is mounted into the container so Django reloads as you edit files.
- `frontend` uses `frontend.Dockerfile`. An entrypoint script compares `package-lock.json` to a cached hash every time the container starts. If dependencies change (e.g., you add Tailwind), `npm ci` is re-run automatically, so you never have to prune a stale `node_modules` volume again.
- Both services expose hot-reload ports (`http://localhost:8000` for Django, `http://localhost:5173` for Vite).

Useful commands:

```bash
# Stop everything and remove ephemeral node_modules volume
docker compose down -v

# Rebuild images after changing Dockerfiles
docker compose build web frontend
```

## 2. Local (non-Docker) development

You can also run each stack directly on your machine if you already have Python and Node installed.

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python backend/manage.py migrate
python backend/manage.py runserver

# Frontend
cd frontend
npm install
npm run dev -- --host
```

The frontend uses Tailwind via Vite, so no extra build steps are required. When running locally, `node_modules` lives next to the source (and remains in `.gitignore`).

## 3. Troubleshooting

- **Dependency mismatch:** delete `frontend/node_modules` (local) or run `docker compose down -v` (Docker) and start again.
- **Watcher limits on Linux:** the compose file already sets `CHOKIDAR_USEPOLLING=true`, but you may still need to increase `fs.inotify.max_user_watches`.
- **Adding new Python packages:** edit `requirements/base.txt` or `requirements/dev.txt`; rebuild the `web` image (`docker compose build web`) to bake them into the container.

This setup keeps the developer ergonomics high without sacrificing reproducibility, and you can switch between Docker and local workflows whenever you need to.
