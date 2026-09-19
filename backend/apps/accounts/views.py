from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from .models import User, Role
from .serializers import UserSerializer, UserRegistrationSerializer
from .permissions import IsAdminUserRole, IsSelfOrAdmin


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD API for users in the sovereign workbench.
    Admins can see and manage all users.
    Standard users can read users or view their own profile.
    """
    queryset = User.objects.all().order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return UserRegistrationSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == "create":
            # Allow registration or restrict to admin based on preference
            return [permissions.AllowAny()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsSelfOrAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """Returns the currently authenticated user's profile and assigned role."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """Direct shortcut for /api/users/me/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
