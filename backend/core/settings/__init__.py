"""
Settings package initializer.

Defaults to the development settings so `core.settings` imports continue to work
for legacy tooling. Override DJANGO_SETTINGS_MODULE to `core.settings.prod`
or another module before invoking Django management commands in other envs.
"""

from .dev import *  # noqa: F401,F403
