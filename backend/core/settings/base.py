from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv, set_key


# ---------------------------------------------------------------------
# Paths and environment helpers
# ---------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

def _env(key, default=None):
    return os.getenv(key, default)

def _env_bool(key, default=False):
    v = os.getenv(key)
    return (v or "").lower() in {"1", "true", "yes"} if v is not None else bool(default)

def _env_list(key, default=""):
    raw = os.getenv(key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]


# ---------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------
KEY_NAME = "SECRET_KEY"
secret = os.getenv(KEY_NAME)
if not secret:
    secret = secrets.token_urlsafe(50)
    set_key(str(ENV_PATH), KEY_NAME, secret)
    try:
        ENV_PATH.chmod(0o644)
    except Exception:
        pass

os.environ[KEY_NAME] = secret
SECRET_KEY = secret

DEBUG = False
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


# ---------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------
INSTALLED_APPS = [
    # local apps
    "apps.api",
    "apps.web",

    # third-party
    "rest_framework",
    "drf_spectacular",
    "corsheaders",

    # default Django apps
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]


# ---------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"


# ---------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------
FRONTEND_DIR = BASE_DIR.parent / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [
            BASE_DIR / "templates",
            *( [FRONTEND_DIST] if FRONTEND_DIST.exists() else [] ),
        ],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"


# ---------------------------------------------------------------------
# Database (SQLite by default; override via env vars)
# ---------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
        "USER": os.getenv("DB_USER", ""),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", ""),
        "PORT": os.getenv("DB_PORT", ""),
    }
}


# ---------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ---------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------------
# Static and media files
# ---------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "assets"]
if FRONTEND_ASSETS.exists():
    STATICFILES_DIRS.append(FRONTEND_ASSETS)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"


# ---------------------------------------------------------------------
# REST Framework & CORS
# ---------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL_ORIGINS", "true").lower() == "true"
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
}
SPECTACULAR_SETTINGS = {
    "TITLE": "Extreme Speech Filter API",
    "DESCRIPTION": "JSON API powering the React frontend",
    "VERSION": "1.0.0",
}


CSRF_TRUSTED_ORIGINS = _env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8000,http://localhost:5173,http://127.0.0.1:5173",
)


# ---------------------------------------------------------------------
# Default primary key field type
# ---------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------
# Project-specific constants
# ---------------------------------------------------------------------
LABEL_MODEL_DIR = BASE_DIR / "services" / "label" / "model" / "artifacts"
MAX_UPLOADS_PER_PRINCIPAL = int(os.getenv("MAX_UPLOADS_PER_PRINCIPAL", "10"))
UPLOAD_RETENTION_HOURS = int(os.getenv("UPLOAD_RETENTION_HOURS", "24"))


RAW_VOSK = os.environ.get("VOSK_MODEL_DIR", "").strip()


def _norm_vosk(val: str | None):
    if not val:
        return None
    s = str(val).strip()
    if s.lower() in {"none", "null", "false", "0"}:
        return None
    return str(Path(s).expanduser().resolve())


VOSK_MODEL_DIR = _norm_vosk(RAW_VOSK)
