import uuid
from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100, help_text="e.g. USER_LOGIN, DOCUMENT_UPLOAD, MODEL_INVOKE")
    resource = models.CharField(max_length=100, help_text="e.g. Document, AgentTask, AuthToken")
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        user_repr = self.user.username if self.user else "Anonymous/System"
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {user_repr} - {self.action} on {self.resource}"
