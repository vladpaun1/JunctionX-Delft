# backend/apps/web/templatetags/mediafmt.py
from django import template

register = template.Library()

@register.filter(name="filesize_km")
def filesize_km(num_bytes):
    """
    Format bytes as KB/MB (binary 1024). Never shows bytes.
    0 -> '0 KB', 1..1023 -> '1 KB', 1536 -> '1.5 MB', etc.
    """
    try:
        n = float(num_bytes or 0)
    except (TypeError, ValueError):
        n = 0.0

    KB = 1024.0
    MB = KB * 1024.0

    if n <= 0:
        return "0 KB"
    if n < MB:
        k = max(1.0, n / KB)
        # 1 decimal only if < 10 KB? Not needed; keep no decimals for KB.
        return f"{int(round(k))} KB"
    m = n / MB
    # MB: 1 decimal for readability
    return f"{m:.1f} MB"

@register.filter(name="mmss")
def mmss(seconds):
    """Format seconds as mm:ss."""
    try:
        s = float(seconds or 0)
    except (TypeError, ValueError):
        s = 0.0
    s = max(0, int(round(s)))
    m, sec = divmod(s, 60)
    return f"{m:02d}:{sec:02d}"
