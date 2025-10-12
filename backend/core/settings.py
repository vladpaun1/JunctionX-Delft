"""
Django settings for core project.

Improved version with .env support and better defaults.
"""

import os
import secrets
from pathlib import Path
from dotenv import load_dotenv, set_key

# ---------------------------------------------------------------------
# Paths and environment
# ---------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from project root
ENV_PATH = BASE_DIR.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------
KEY_NAME = "SECRET_KEY"

secret = os.getenv(KEY_NAME)

if not secret:
    secret = secrets.token_urlsafe(50)
    set_key(str(ENV_PATH), KEY_NAME, secret)
    try:
        ENV_PATH.chmod(0o777)
    except Exception:
        pass

os.environ[KEY_NAME] = secret
SECRET_KEY = secret

DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "web",
]

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
            BASE_DIR / "templates",             # keep any Django templates
            *( [FRONTEND_DIST] if FRONTEND_DIST.exists() else [] ),  # Vite build ouput
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
# Database
# ---------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.getenv("DB_NAME", BASE_DIR / "db.sqlite3"),
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

# Static files: keep your existing assets, plus dist/assets if present
STATICFILES_DIRS = [BASE_DIR / "assets"]
if FRONTEND_ASSETS.exists():
    STATICFILES_DIRS.append(FRONTEND_ASSETS)

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------
# REST Framework & CORS
# ---------------------------------------------------------------------

# Local dev: front-end via Vite @localhost:5173
CORS_ALLOW_ALL_ORIGINS = True  # for learning; lock down later

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



CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# ---------------------------------------------------------------------
# Default primary key field type
# ---------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------
# Project-specific constants
# ---------------------------------------------------------------------

LABEL_MODEL_DIR = BASE_DIR / "services" / "label" / "model" / "artifacts"


RAW_VOSK = os.environ.get("VOSK_MODEL_DIR", "").strip()

def _norm_vosk(val: str | None):
    if not val:
        return None
    s = str(val).strip()
    if s.lower() in {"none", "null", "false", "0"}:
        return None
    # allow relative paths, resolve to absolute
    return str(Path(s).expanduser().resolve())

VOSK_MODEL_DIR = _norm_vosk(RAW_VOSK)
