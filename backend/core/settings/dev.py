from .base import *  # noqa

def _env(key, default=None):
    return os.getenv(key, default)

def _env_bool(key, default=False):
    v = os.getenv(key)
    return (v or "").lower() in {"1", "true", "yes"} if v is not None else bool(default)

def _env_list(key, default=""):
    raw = os.getenv(key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]

DEBUG = True
ALLOWED_HOSTS = ["*"]
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
