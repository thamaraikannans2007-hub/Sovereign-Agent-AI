import uuid
import os
from django.db import models
from django.conf import settings


class DocumentStatus(models.TextChoices):
    UPLOADED = "UPLOADED", "Uploaded"
    SCANNING = "SCANNING", "Scanning / Ingesting"
    READY = "READY", "Ready"
    FAILED = "FAILED", "Failed"


def document_upload_path(instance, filename):
    return f"vault/documents/{instance.uploaded_by.id}/{uuid.uuid4()}_{filename}"


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to=document_upload_path)
    type = models.CharField(max_length=50, blank=True)
    size = models.BigIntegerField(default=0, help_text="Size in bytes")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_documents",
    )
    status = models.CharField(
        max_length=20,
        choices=DocumentStatus.choices,
        default=DocumentStatus.READY,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Confidential Document"
        verbose_name_plural = "Confidential Documents"

    def __str__(self):
        return f"{self.name} ({self.status})"

    def save(self, *args, **kwargs):
        if self.file and not self.size:
            try:
                self.size = self.file.size
            except Exception:
                pass
        if not self.type:
            target_name = (self.file.name if self.file else "") or self.name
            if target_name:
                _, ext = os.path.splitext(target_name)
                self.type = ext.lstrip(".").lower()
        super().save(*args, **kwargs)
