import uuid
from django.db import models
from apps.accounts.models import Role


class Tool(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, help_text="e.g. cad_parser, telemetry_analyzer")
    description = models.TextField()
    permission_required = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ENGINEER,
        help_text="Minimum role required to authorize this tool for agent execution",
    )
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Industrial Tool"
        verbose_name_plural = "Industrial Tools"

    def __str__(self):
        return f"{self.name} (Requires {self.permission_required})"
