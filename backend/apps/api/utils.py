# backend/apps/api/utils.py
from __future__ import annotations
from pathlib import Path
from django.conf import settings
from apps.web.models import UploadJob

def principal_filter(request) -> dict:
    if request.user.is_authenticated:
        return {"user": request.user}
    if not request.session.session_key:
        request.session.save()
    return {"session_key": request.session.session_key}

def rel_media_path(pth: str | Path | None) -> str:
    if not pth:
        return ""
    s = str(pth)
    i = s.find("/media/")
    return s[i:] if i >= 0 else s

def normalize_label(label: str | None) -> str:
    if not label:
        return ""
    ll = str(label).strip().lower()
    if "terror" in ll:
        return "Abuse"
    if "hate" in ll:
        return "Hate speech"
    if "bad" in ll:
        return "Bad language"
    return str(label)

def normalize_labels_list(labels) -> list:
    out = []
    if not isinstance(labels, list):
        return out
    for item in labels:
        if isinstance(item, (list, tuple)) and len(item) >= 4:
            label, text, start, end = item[0], item[1], item[2], item[3]
            out.append([normalize_label(label), text, start, end])
        elif isinstance(item, dict):
            new_item = dict(item)
            new_item["label"] = normalize_label(item.get("label") or item.get("type") or "")
            out.append(new_item)
        else:
            out.append(item)
    return out
