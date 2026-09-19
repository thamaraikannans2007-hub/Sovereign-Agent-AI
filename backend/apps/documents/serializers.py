from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "name",
            "file",
            "type",
            "size",
            "uploaded_by",
            "uploaded_by_username",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "size", "type", "uploaded_by", "created_at"]

    def create(self, validated_data):
        validated_data["uploaded_by"] = self.context["request"].user
        return super().create(validated_data)
