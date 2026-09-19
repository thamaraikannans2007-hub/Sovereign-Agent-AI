from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CurrentUserView

router = DefaultRouter()
router.register(r"", UserViewSet, basename="user")

urlpatterns = [
    path("me/", CurrentUserView.as_view(), name="user-current"),
    path("", include(router.urls)),
]
