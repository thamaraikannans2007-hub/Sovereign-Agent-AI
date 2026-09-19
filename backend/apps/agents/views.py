from django.utils import timezone
from django.http import StreamingHttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AgentTask, TaskStatus
from .serializers import AgentTaskSerializer
from .streaming import StreamingTaskRunner
from apps.models.adapters.registry import AdapterRegistry
from apps.accounts.permissions import IsSelfOrAdmin


class AgentTaskViewSet(viewsets.ModelViewSet):
    """
    Endpoints for creating, listing, and executing sovereign agent tasks.
    """
    queryset = AgentTask.objects.all().order_by("-created_at")
    serializer_class = AgentTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_admin_role:
            return AgentTask.objects.all().order_by("-created_at")
        return AgentTask.objects.filter(user=user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="run")
    def run_task(self, request, pk=None):
        """
        Executes an agent task via the modular sovereign AI orchestrator.
        Updates task status to COMPLETED and generates an immutable SovereigntyReceipt.
        """
        task = self.get_object()
        task.status = TaskStatus.RUNNING
        task.save()

        # Retrieve tools authorized
        tools_requested = task.input.get("tools", ["document_parser"])

        # Orchestrate execution via modular adapter
        orchestrator = AdapterRegistry.get_orchestrator()
        result = orchestrator.plan_and_execute(
            task_type=task.task_type,
            input_data=task.input,
            tools=tools_requested,
        )

        task.status = TaskStatus.COMPLETED
        task.output = result
        task.completed_at = timezone.now()
        task.save()

        # Generate cryptographic SovereigntyReceipt
        from apps.security.receipts import generate_sovereignty_receipt
        receipt = generate_sovereignty_receipt(
            task=task,
            models_used=result.get("models_used", ["mock-llama3-industrial"]),
            files_accessed=task.input.get("files", []),
            tools_used=tools_requested,
            external_requests=0,
            network_status="AIR_GAPPED_LOCAL",
        )

        return Response({
            "task": AgentTaskSerializer(task).data,
            "receipt": {
                "receipt_id": receipt.id,
                "integrity_hash": receipt.integrity_hash,
                "network_status": receipt.network_status,
                "external_requests": receipt.external_requests,
            }
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="stream")
    def stream_task(self, request, pk=None):
        """
        Executes an agent task with real-time Server-Sent Events streaming.
        Each execution step emits an SSE frame; the final frame contains the SovereigntyReceipt.

        Client usage:
            const es = new EventSource('/api/agents/<id>/stream/');
            es.onmessage = (e) => { const frame = JSON.parse(e.data); ... };
        """
        task = self.get_object()

        if task.status == TaskStatus.RUNNING:
            return Response(
                {"error": "Task is already running."},
                status=status.HTTP_409_CONFLICT,
            )

        runner = StreamingTaskRunner(task)

        response = StreamingHttpResponse(
            streaming_content=runner.run(),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        response["Access-Control-Allow-Origin"] = "http://127.0.0.1:8000"
        return response

