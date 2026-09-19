from rest_framework import serializers
from .models import AgentTask


class AgentTaskSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = AgentTask
        fields = [
            "id",
            "task_id",
            "user",
            "user_username",
            "task_type",
            "status",
            "input",
            "output",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["id", "task_id", "user", "status", "output", "created_at", "completed_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
