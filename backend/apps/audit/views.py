from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.accounts.permissions import IsAdminUserRole


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log endpoint for compliance, restricted to Admins.
    """
    queryset = AuditLog.objects.all().order_by("-timestamp")
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
