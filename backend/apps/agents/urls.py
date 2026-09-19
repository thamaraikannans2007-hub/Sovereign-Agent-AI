from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AgentTaskViewSet

router = DefaultRouter()
router.register(r"", AgentTaskViewSet, basename="agent-task")

urlpatterns = [
    path("", include(router.urls)),
]
