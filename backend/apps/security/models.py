import uuid
from django.db import models
from apps.agents.models import AgentTask


class SovereigntyReceipt(models.Model):
    """
    Cryptographically sealed proof of zero external data egress and localized
    model execution for confidential industrial AI workflows.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        AgentTask,
        on_delete=models.CASCADE,
        related_name="sovereignty_receipts",
    )
    models_used = models.JSONField(default=list, help_text="List of local models utilized")
    files_accessed = models.JSONField(default=list, help_text="Vault files read during execution")
    tools_used = models.JSONField(default=list, help_text="Tool IDs/names invoked")
    external_requests = models.IntegerField(
        default=0,
        help_text="Count of outbound external network requests made (Must be 0 in sovereign operation)",
    )
    network_status = models.CharField(
        max_length=50,
        default="AIR_GAPPED_LOCAL",
        help_text="Network confinement state at time of run",
    )
    integrity_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 tamper-evident hash of all receipt parameters",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Sovereignty Receipt"
        verbose_name_plural = "Sovereignty Receipts"

    def __str__(self):
        return f"Receipt [{self.id}] for Task [{self.task.task_id}] (Egress: {self.external_requests})"
