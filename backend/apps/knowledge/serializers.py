from rest_framework import serializers
from .models import KnowledgeBase, KnowledgeChunk


class KnowledgeChunkSerializer(serializers.ModelSerializer):
    """Serializer for individual RAG chunks (read-only, no embedding field exposed)."""

    class Meta:
        model = KnowledgeChunk
        fields = [
            "id",
            "knowledge_base",
            "source_document_name",
            "chunk_index",
            "content",
            "created_at",
        ]
        read_only_fields = fields


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = KnowledgeBase
        fields = [
            "id",
            "name",
            "description",
            "created_by",
            "created_by_username",
            "created_at",
            "rag_indexed",
            "chunk_count",
        ]
        read_only_fields = ["id", "created_by", "created_at", "rag_indexed", "chunk_count"]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

