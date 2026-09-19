from rest_framework import serializers
from .models import ModelRegistry


class ModelRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ModelRegistry
        fields = [
            "id",
            "name",
            "provider",
            "model_type",
            "endpoint",
            "status",
            "capabilities",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
