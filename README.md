# Extreme Speech Filter — Backend

## Quick start
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python backend/manage.py migrate
python backend/qmanage.py runserver 0.0.0.0:8000
```
Test: ```GET /api/ping/``` → ```{"status":"ok","service":"backend"}```




# Repo layout
```bash
extreme-speech-filter/
├─ backend/
│  ├─ manage.py
│  ├─ core/
│  ├─ apps/
│  │  └─ api/                  # API endpoints (/api/analyze, /api/ping, etc.)
│  ├─ services/
│  │  ├─ asr/                  # ASR engines (Vosk now; others later)
│  │  │  ├─ __init__.py
│  │  │  └─ vosk_engine.py     # thin wrapper around Vosk
│  │  └─ pipeline/             # simple orchestrators/helpers
│  │     ├─ __init__.py
│  │     └─ steps.py           # convert → transcribe → label → export
│  ├─ media/
│  │  ├─ uploads/              # raw user uploads (kept for traceability)
│  │  ├─ normalized/           # WAV mono 16-bit files fed to ASR
│  │  ├─ transcripts/          # JSON transcripts
│  │  └─ labels/               # JSON labels from the next stage
│  ├─ templates/ (optional)
│  └─ static/ (optional)
├─ data/
│  └─ models/
│     └─ vosk/
│        └─ model/             # unpacked model dir (gitignored)
├─ scripts/
│  └─ download_vosk_model.py
└─ requirements/
```


# Django in 5 minutes (how we use it)
## 1) URLs → Views

- URLconf routes HTTP paths to Python callables (views).
- Root router: backend/core/urls.py
- App router: backend/apps/<appname>/urls.py

We mount app routes under /api/ (or another prefix) using include().
### Example:

```python
# backend/apps/api/urls.py
from django.urls import path
from .views import PingView

urlpatterns = [
    path("ping/", PingView.as_view(), name="ping"),
]
```

```python
# backend/core/urls.py
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("apps.api.urls")),
]
```

## 2) Views (Django REST Framework)

We use DRF’s APIView for JSON APIs.

Return Response({...}) with JSON-serializable data.
```python
# backend/apps/api/views.py
from rest_framework.views import APIView
from rest_framework.response import Response

class PingView(APIView):
    def get(self, request):
        return Response({"status": "ok"})
```
For payload validation/serialization, add DRF Serializer classes.

## 3) Models & ORM

Models live in each app’s models.py.

Run makemigrations when you change models; run migrate to apply to DB.
```python 
# backend/apps/api/models.py
from django.db import models

class AnalysisJob(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    filename = models.CharField(max_length=255)
    transcript = models.JSONField(default=dict, blank=True)
```
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
```

Querying (examples):
```python
from apps.api.models import AnalysisJob
AnalysisJob.objects.create(filename="demo.wav", transcript={"text": "hello"})
AnalysisJob.objects.filter(filename__icontains="demo")
```

## 4) Admin (handy for quick inspection)
```bash
cd backend
python manage.py createsuperuser
# visit http://127.0.0.1:8000/admin/
```
Register your models in apps/api/admin.py:
```python
from django.contrib import admin
from .models import AnalysisJob
admin.site.register(AnalysisJob)
```

## 5) Templates (if we render HTML pages)

Global templates: backend/templates/

App templates: backend/apps/<app>/templates/<app>/...

Turn on template discovery via APP_DIRS=True (already default).

Access variables with {{ var }}, logic with {% ... %}.

Basic example:
```html
{# backend/templates/index.html #}
{% extends "base.html" %}
{% block content %}
  <h1>Upload audio</h1>
  <form method="post" enctype="multipart/form-data">
    {% csrf_token %}
    <input type="file" name="file" accept="audio/*">
    <button type="submit">Analyze</button>
  </form>
{% endblock %}
```

Useful template tags:

{{ variable }} – output

{% if %}…{% endif %}, {% for x in xs %}…{% endfor %}

{% extends "base.html" %}, {% block content %}{% endblock %}

{% load static %} + <link href="{% static 'css/site.css' %}" rel="stylesheet">

For our API-first MVP we may not need templates; if we add a simple upload page, put it under backend/templates/ and add a basic Django view that returns render(request, "index.html").

## 6) Static files (CSS/JS/images)

Put global assets in backend/static/.

Settings:
```python 
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
```
WhiteNoise serves static files in dev and production without extra infra.

Collect (for production builds):
```bash
cd backend
python manage.py collectstatic --noinput
```
## 7) Media (uploaded files)

Files uploaded by users live under backend/media/.

Settings:
```python
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
```
When accepting uploads in a view, save to MEDIA_ROOT (or use default_storage).

## Adding a new app (pattern)
```bash
cd backend
mkdir -p apps
python manage.py startapp web apps/web

# settings.py
INSTALLED_APPS += ["apps.web"]

# core/urls.py
path("", include("apps.web.urls")),
```
Gotcha: app path in INSTALLED_APPS must match apps.py. Use apps.<name> consistently.

## Vosk basics (for later endpoints)

Install models into data/models/vosk/model/ (download script can automate).

In code:

```python
from django.conf import settings
from vosk import Model, KaldiRecognizer
import wave, json

model = Model(settings.VOSK_MODEL_DIR + "/model")
wf = wave.open(wav_path, "rb")
rec = KaldiRecognizer(model, wf.getframerate())
rec.SetWords(True)
```
Expect mono, 16-bit PCM WAV for the MVP (convert ahead of time if needed).

## Dev tools (from requirements/dev.txt)
Formatters & linters
```bash
# Format code
black backend

# Sort imports
isort backend

# Lint (style/errors)
flake8 backend
```

```bash
pip install pre-commit
cat > .pre-commit-config.yaml << 'YAML'
repos:
- repo: https://github.com/psf/black
  rev: 24.8.0
  hooks: [{id: black}]
- repo: https://github.com/pycqa/isort
  rev: 5.13.2
  hooks: [{id: isort}]
- repo: https://github.com/pycqa/flake8
  rev: 7.1.1
  hooks: [{id: flake8}]
YAML

pre-commit install
# from now on, format/lint run on every commit
```

## Tests (pytest + pytest-django)

Create backend/apps/api/tests/test_ping.py:
```python
def test_ping(client):
    r = client.get("/api/ping/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
```
Run:
```bash
pytest -q
```
pytest-django auto-detects the Django settings; if needed, set DJANGO_SETTINGS_MODULE=core.settings.

## Common commands (cheatsheet)
```bash
# run dev server
cd backend && python manage.py runserver 0.0.0.0:8000

# db migrations
python manage.py makemigrations
python manage.py migrate

# create admin user
python manage.py createsuperuser

# collect static (for prod)
python manage.py collectstatic --noinput
```

# The challenge

Speech and voice technology is increasingly used, e.g., in emergency response centers, domestic voice assistants, and search engines. Because of the paramount relevance spoken language plays in our lives, it is critical that speech technology systems are able to
deal with the variability in the way people speak (e.g., due to speaker differences, demographics, different speaking styles, and differently abled users). A big issue is finding speech data to train the deep-learning-based speech systems: existing data is scarce. Potentially, freely available data could be used; however, these need to be carefully checked for extremist views as we should avoid using questionable data that could perpetuate bias and extremist views. We are excited to challenge you to create a system to automatically screen audio (and video) for extremist views as a key step to alleviating freely available speech data for the development of inclusive speech technology.

To use freely available speech data for training inclusive speech technology they need to be screened for extremist views and bad language to avoid potentially perpetuating these extremist views and bias into our systems. How can this be done? The actual challenge is not making (e.g., coding) the system, it is its design. You need to carefully define what constitutes “extreme views” or “bad language”, your definition needs to be made responsibly. Think of the implications your definition (and its implementation in the form of a system or solution you will provide) can have on society, think of the ethical, social and legal responsibilities it implies.

# Insights

Responsibly determine what constitutes an extreme view and/or bad language, and make, build, or code a system that automatically finds these within large datasets of audio (and/or video) and provide the timestamps of the identified speech stretches in an efficient and fast manner. Ideally, in a user-friendly way. The speech can be audio-only or the audio part of video and needs to be in English.

# What we'll bring

During the event, participants will be creating an innovative approach to screen large amounts of audio data for extremist views and bad language. We will provide pointers to a reference dataset to be used as test dataset, and guidelines for participants to find suitable datasets they can work with. At 12hrs after the start of the hackathon you will receive an automatic message with the link to the test dataset, such that you can show us that your system works on the data we have picked up to test your system.

# The Prizes

The prize is a collaboration with the DISC lab at TUDelft, to e.g., turn the concepts/systems into an academic publication, or to further develop the system.

# Judging criteria

To win carefully consider the following aspects:
1. The more refined, robust, and responsible your definition of “extremist view / bad language”, the more points you will get. You are encouraged to provide in written (briefly) your reasoning on why you believe your definition fulfills these aspects.
2. Your solution can be made in a system implemented in any way. It might be a webbased solution (e.g., a website), it might be a client-server solution, or even a local (client-only) solution, and e.g., be given in the form of a mobile or desktop app.
3. The proposed solution needs to be of own authorship; any suspicion of plagiarism in any form can result in disqualification. Remember: reusing code, software, or tools with a proper license and properly referring and citing your sources is not plagiarism.
4. At a minimum the proposed system or solution needs to be able to indicate whether there are extremist views in the audio/video. Additional points will be given if the system is able to provide timestamps in the audio, and if it is fast and efficient. Additional points are given if your solution is readily available as a free to use, privacy preserving, open, and easily deployable system: e.g., a free and open- source server-client solution; say an Android app that connects to (a free and opensource) server, without using any proprietary frameworks.
5. Participants are allowed to work with our reference datasets or with their own datasets, e.g., from the Internet to, e.g., train your system. However 12 hrs after the start of the hackathon you will receive a link with the test dataset to show how your system works on the data we have picked up to test your system.
6. Participants are only allowed to use data that has a suitable copyright license for the hackathon. It is not allowed to infringe any copyright rules, laws, or regulations (including privacy) in any jurisdiction in acquiring, using or reusing the data, nor in the use of any tools or means for making the system.

# About the company

The Delft Inclusive Speech Communication (DISC) lab at TU Delft is an internationally
renowned lab focusing on developing inclusive speech technology, i.e., speech technology
for everyone, irrespective of a speaker’s voice, language, and the way they speak. The lab
focuses on investigating and mitigating bias in speech technology, with a focus on
automatic speech recognition (ASR; speech-to-text). We are excited to work with the
winner of the challenge to further develop their solution for distribution to the speech
technology field.
