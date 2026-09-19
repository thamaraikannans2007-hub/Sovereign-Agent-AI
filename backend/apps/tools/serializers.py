from rest_framework import serializers
from .models import Tool


class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tool
        fields = [
            "id",
            "name",
            "description",
            "permission_required",
            "enabled",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
