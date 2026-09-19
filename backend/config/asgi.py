import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Base ASGI application (Channels routing can be mounted here when WebSockets are activated)
application = get_asgi_application()
