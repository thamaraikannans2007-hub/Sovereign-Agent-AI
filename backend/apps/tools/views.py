from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Tool
from .serializers import ToolSerializer
from apps.accounts.permissions import IsEngineerOrAdmin


class ToolViewSet(viewsets.ModelViewSet):
    """
    Registry for tools available to agent tasks.
    Creation/editing restricted to Engineer and Admin roles.
    """
    queryset = Tool.objects.all().order_by("name")
    serializer_class = ToolSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsEngineerOrAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle_tool(self, request, pk=None):
        """Toggles a tool's enabled state."""
        tool = self.get_object()
        tool.enabled = not tool.enabled
        tool.save()
        return Response({
            "id": tool.id,
            "name": tool.name,
            "enabled": tool.enabled,
        }, status=status.HTTP_200_OK)
