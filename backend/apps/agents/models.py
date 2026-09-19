import uuid
from django.db import models
from django.conf import settings


class TaskStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class AgentTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_id = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_tasks",
    )
    task_type = models.CharField(max_length=100, help_text="e.g. DOC_ANALYSIS, CODE_AUDIT, TELEMETRY_INSPECTION")
    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.PENDING,
    )
    input = models.JSONField(default=dict, blank=True)
    output = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Agent Task"
        verbose_name_plural = "Agent Tasks"

    def __str__(self):
        return f"{self.task_id} [{self.task_type}] - {self.status}"

    def save(self, *args, **kwargs):
        if not self.task_id:
            self.task_id = f"SOV-TASK-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)
