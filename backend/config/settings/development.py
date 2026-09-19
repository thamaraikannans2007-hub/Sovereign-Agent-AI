from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*"]

# In development, keep CORS open for frontend dev servers
CORS_ALLOW_ALL_ORIGINS = True

LOGGING["loggers"]["apps"]["level"] = "DEBUG"
