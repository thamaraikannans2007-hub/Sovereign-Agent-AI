import os
from .base import *

DEBUG = False

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",")

# Strict HTTPS and cookie hardening for production sovereign environments
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True

# Disable CORS wildcards
CORS_ALLOW_ALL_ORIGINS = False

LOGGING["root"]["level"] = "WARNING"
LOGGING["loggers"]["apps"]["level"] = "INFO"
