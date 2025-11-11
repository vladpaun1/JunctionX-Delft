from .base import *  # noqa

def _env(key, default=None):
    return os.getenv(key, default)

def _env_bool(key, default=False):
    v = os.getenv(key)
    return (v or "").lower() in {"1", "true", "yes"} if v is not None else bool(default)

def _env_list(key, default=""):
    raw = os.getenv(key, default)
    return [s.strip() for s in raw.split(",") if s.strip()]

DEBUG = False
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "api.trashpanda.vladpaun.com")
CSRF_TRUSTED_ORIGINS = _env_list(
    "CSRF_TRUSTED_ORIGINS",
    "https://api.trashpanda.vladpaun.com",
)

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = bool(int(os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", "0")))
SECURE_HSTS_PRELOAD = bool(int(os.getenv("SECURE_HSTS_PRELOAD", "0")))
