from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ModelRegistryViewSet

router = DefaultRouter()
router.register(r"", ModelRegistryViewSet, basename="model-registry")

urlpatterns = [
    path("", include(router.urls)),
]
