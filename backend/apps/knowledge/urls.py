from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeViewSet

router = DefaultRouter()
router.register(r"", KnowledgeViewSet, basename="knowledge")

urlpatterns = [
    path("", include(router.urls)),
]
