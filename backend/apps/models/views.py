from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ModelRegistry
from .serializers import ModelRegistrySerializer
from .adapters.registry import AdapterRegistry
from apps.accounts.permissions import IsEngineerOrAdmin


class ModelRegistryViewSet(viewsets.ModelViewSet):
    """
    CRUD and health diagnostics for registered local AI models.
    """
    queryset = ModelRegistry.objects.all().order_by("model_type", "name")
    serializer_class = ModelRegistrySerializer
    permission_classes = [permissions.IsAuthenticated, IsEngineerOrAdmin]

    @action(detail=True, methods=["post"], url_path="ping")
    def ping_model(self, request, pk=None):
        """Tests local model inference readiness via adapter."""
        model_instance = self.get_object()
        adapter = AdapterRegistry.get_llm_adapter(
            provider=model_instance.provider,
            model_name=model_instance.name,
            endpoint=model_instance.endpoint or None,
        )
        sample_output = adapter.generate(prompt="Local sovereign ping diagnostic test")
        return Response({
            "status": "ready",
            "model": model_instance.name,
            "provider": model_instance.provider,
            "diagnostic_result": sample_output,
        }, status=status.HTTP_200_OK)
