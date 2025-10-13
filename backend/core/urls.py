# backend/core/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

from django.views.generic.base import RedirectView

# backend/core/urls.py
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("apps.api.urls")),
]

# --- Serve the React SPA in production (after `npm run build`)
# Put your built files in e.g. backend/templates/index.html and collect static
# or configure TEMPLATES to find the dist/index.html. Adjust as needed.
if settings.DEBUG:
    # Dev convenience: redirect root to Vite dev server
    urlpatterns += [
        path("", RedirectView.as_view(url="http://localhost:5173/", permanent=False)),
    ]
else:
    # Prod: serve the built SPA
    urlpatterns += [
        re_path(r"^(?!api/|admin/|static/|media/).*$",
                TemplateView.as_view(template_name="index.html"),
                name="spa"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)