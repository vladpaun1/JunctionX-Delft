# Trash Panda · Speech Hygiene Pipeline

[![Release](https://img.shields.io/badge/release-v0.1.0-blue.svg)](#releases) 
[![Backend](https://img.shields.io/badge/Django-5.0-0C4B33?logo=django&logoColor=fff)](backend) 
[![Frontend](https://img.shields.io/badge/Vite%2FReact-5.0-646CFF?logo=vite&logoColor=fff)](frontend) 
[![ASR](https://img.shields.io/badge/ASR-Whisper-orange)](backend/services/asr) 
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE)

Trash Panda is our hackathon-built platform for triaging open-source speech datasets before they reach inclusive voice-technology pipelines. Upload an audio/video batch, we normalize it, transcribe with Whisper, classify each span for hate/abuse, and return flagged transcripts—all behind anonymous browser sessions so strangers can safely demo the system.

---

## ✨ Highlights

- **Dual build targets**: Django REST API + Vite/React SPA, both shipped as immutable images on GHCR.
- **Modern ASR**: Faster-Whisper handles transcription; no Vosk baggage required.
- **Inline toxicity labeling**: Custom classifier + profanity fallback mark suspicious spans in-place.
- **Session-scoped uploads**: Anonymous visitors get isolated queues, capped at 10 jobs, with automated cleanup hooks.
- **Traefik-ready deployment**: Compose stack expects an `edge` network and Cloudflare DNS-01 certificates.

---

## 🧱 Stack Snapshot

| Layer        | Tech                                                         |
| ------------ | ------------------------------------------------------------ |
| API          | Django 5 · DRF · Gunicorn · PostgreSQL (prod) / SQLite (dev) |
| ASR + NLP    | Faster-Whisper · Custom sklearn classifiers + profanity check |
| Frontend     | Vite · React 18 · Bootstrap 5 · custom Toast/Jobs UI         |
| Storage      | Local media volume (`/app/media`) + Whisper cache volume (`/models`) |
| Ops          | Docker · Traefik 2.11 · Cloudflare DNS-01 · GitHub Container Registry |

---

## 🗺️ Architecture

1. **Upload** — Browser session POSTs `/api/jobs/bulk/` with files, receives job IDs immediately.
2. **Pipeline** — Background thread normalizes audio (ffmpeg), runs Whisper, classifies spans, and stores artifacts under `media/`.
3. **Review** — Frontend polls `/api/jobs/` for status, renders transcripts with inline bad-language chips, enables JSON export.
4. **Isolation** — `UploadJob` rows record either `user_id` or session key; API permissions ensure visitors only see their session jobs.
5. **Retention** — `cleanup_uploads` management command purges uploads + normalized audio + transcripts after `UPLOAD_RETENTION_HOURS`.

---

## 🧑‍💻 Local Development

### Prerequisites

- Docker + Docker Compose (for the default workflow)
- Python 3.12 + Node 20 (optional if you want to run services outside Docker)

### One-command dev stack

```bash
# hot-reload API on :8000 and Vite SPA on :5173
docker compose up   # or docker compose -f docker-compose.dev.yml up
```

The dev compose mounts your working copy, sets `DJANGO_SETTINGS_MODULE=core.settings.dev`, and leaves migrations to run manually inside the container or your local venv:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python backend/manage.py migrate
```

---

## 📦 Production Images

| Image                         | Dockerfile                      | Entrypoint                                                     |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `ghcr.io/<org>/trash-panda-api` | `backend/Dockerfile.prod`        | `gunicorn core.wsgi:application -w 3 -b 0.0.0.0:8000`           |
| `ghcr.io/<org>/trash-panda-web` | `frontend/Dockerfile.prod`       | `nginx -g "daemon off;"` (serves Vite build with SPA fallback) |

Key build notes:
- Backend image includes ffmpeg, Whisper runtime deps, `backend/services/label/model/artifacts/`, and exposes `/app/media` + `/models` as volumes.
- Frontend image performs a Node build stage, then copies static files into nginx with cache-friendly headers for `/assets/`.
- Publish with `docker build -f backend/Dockerfile.prod ...` and push to GHCR; the production compose only pulls images.

---

## 🚀 Deploying with Traefik

In your infra repo (e.g., `/srv/docker/stacks/trash-panda`):

1. Copy the production `docker-compose.yml` (Traefik-friendly labels, Postgres volume, media/Whisper mounts).
2. Drop a real `.env` alongside it. Required keys:
   ```dotenv
   WEB_HOST=trashpanda.vladpaun.com
   DJANGO_ALLOWED_HOSTS=trashpanda.vladpaun.com
   CSRF_TRUSTED_ORIGINS=https://trashpanda.vladpaun.com
   DB_*  # Postgres creds
   POSTGRES_*  # same creds for the container
   TRAEFIK_CERTRESOLVER=cf
   ```
3. Authenticate the server to GHCR (`docker login ghcr.io -u <user> -p <PAT>`).
4. Deploy:
   ```bash
   docker compose pull
   docker compose up -d
   ```

Traefik should already expose an `edge` network. The API service joins both `trash-panda-appnet` (internal) and `edge`, letting Traefik route `https://trashpanda.vladpaun.com/api/*` straight to Gunicorn without path stripping.

### Applying migrations on deploy

Add a migration step before Gunicorn in your production compose (or run it manually):

```yaml
command: >
  sh -c "python backend/manage.py migrate --noinput &&
         gunicorn core.wsgi:application -w 3 -b 0.0.0.0:8000"
```

---

## 🔐 Demo Guardrails & Maintenance

- **Per-session quotas:** `MAX_UPLOADS_PER_PRINCIPAL` (default 10) caps queued jobs for anonymous visitors; exceeding it returns an informative 400 error until old jobs are deleted.
- **Nightly cleanup:** `python backend/manage.py cleanup_uploads --hours 24` removes stale uploads, normalized WAVs, and transcripts; schedule this via cron or a managed task runner.
- **Session reset API:** `/api/reset-session/` clears the anonymous session and re-triggers the onboarding modal, useful for demos.
- **Traefik buffering (optional):** enable the commented middleware in the compose file to allow larger uploads without overwhelming Gunicorn workers.

---

## 🗃️ Training Artifacts

Training scripts live under `backend/services/label/training/`. To rebuild classifiers locally:

```bash
python datasets/final_conversion.py
python -m backend.services.label.training.svm_train \
  --data datasets/final/unified_dataset.csv \
  --out backend/services/label/model/artifacts
# repeat for rf_train / lr_train
```

Those artifacts are already checked in so the production image can load them without running the training pipeline.

---

## 🧾 Release Workflow

1. Update docs/README/compose as needed.
2. Commit and push to `main`.
3. Tag a release (`git tag v0.x.y && git push --tags`) or use GitHub’s “Draft a new release” pointing to that commit.
4. Build & push the backend/frontend images for that tag.


---

## 📚 Bibliography

- Cjadams et al., *Toxic Comment Classification Challenge*, Kaggle, 2017.  
- Costa-jussà et al., *MuTox: Universal Multilingual Audio-based Toxicity Dataset*, ACL Findings 2024.  
- Davidson et al., *Automated Hate Speech Detection and the Problem of Offensive Language*, ICWSM 2017.  
- Gibert et al., *Hate Speech Dataset from a White Supremacy Forum*, ALW2 2018.  
- Kennedy et al., *Introducing the Gab Hate Corpus*, LRE 2022.
