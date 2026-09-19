from rest_framework import permissions
from .models import Role


class IsAdminUserRole(permissions.BasePermission):
    """Allows access only to Admin users or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == Role.ADMIN or request.user.is_superuser)
        )


class IsEngineerOrAdmin(permissions.BasePermission):
    """Allows access to Engineers, Admins, or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.role in [Role.ADMIN, Role.ENGINEER]
                or request.user.is_superuser
            )
        )


class IsAnalystOrAbove(permissions.BasePermission):
    """Allows access to Analysts, Engineers, Admins, or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.role in [Role.ADMIN, Role.ENGINEER, Role.ANALYST]
                or request.user.is_superuser
            )
        )


class IsSelfOrAdmin(permissions.BasePermission):
    """Allows users to view/edit their own data, or Admins full access."""

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == Role.ADMIN or request.user.is_superuser:
            return True
        return obj == request.user or getattr(obj, "user", None) == request.user or getattr(obj, "uploaded_by", None) == request.user
