import uuid
from django.db import models
from django.conf import settings


class KnowledgeBase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_knowledge_bases",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    rag_indexed = models.BooleanField(default=False, help_text="True once this KB has been embedded and indexed into the vector store.")
    chunk_count = models.PositiveIntegerField(default=0, help_text="Total number of chunks indexed.")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Knowledge Base"
        verbose_name_plural = "Knowledge Bases"

    def __str__(self):
        return self.name


class KnowledgeChunk(models.Model):
    """
    A single text chunk derived from a source document, with its embedding vector
    stored for local sovereign RAG retrieval.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    knowledge_base = models.ForeignKey(
        KnowledgeBase,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    source_document_name = models.CharField(max_length=512, blank=True)
    chunk_index = models.PositiveIntegerField(default=0, help_text="Zero-based index of this chunk within the source document.")
    content = models.TextField(help_text="Raw text content of this chunk.")
    # Embedding stored as a JSON float list — no external vector DB required
    embedding = models.JSONField(default=list, blank=True, help_text="Local embedding vector (float list).")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["knowledge_base", "chunk_index"]
        verbose_name = "Knowledge Chunk"
        verbose_name_plural = "Knowledge Chunks"

    def __str__(self):
        return f"[{self.knowledge_base.name}] chunk #{self.chunk_index} — {self.source_document_name}"
