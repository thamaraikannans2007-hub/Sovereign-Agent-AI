from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SovereigntyReceiptViewSet

router = DefaultRouter()
router.register(r"", SovereigntyReceiptViewSet, basename="sovereignty-receipt")

urlpatterns = [
    path("", include(router.urls)),
]
