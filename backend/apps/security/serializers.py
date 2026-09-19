from rest_framework import serializers
from .models import SovereigntyReceipt


class SovereigntyReceiptSerializer(serializers.ModelSerializer):
    task_identifier = serializers.CharField(source="task.task_id", read_only=True)
    task_type = serializers.CharField(source="task.task_type", read_only=True)

    class Meta:
        model = SovereigntyReceipt
        fields = [
            "id",
            "task",
            "task_identifier",
            "task_type",
            "models_used",
            "files_accessed",
            "tools_used",
            "external_requests",
            "network_status",
            "integrity_hash",
            "created_at",
        ]
        read_only_fields = fields
