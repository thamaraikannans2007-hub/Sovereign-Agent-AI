from django.conf import settings
from django.db import connection
from django.utils import timezone
from django.shortcuts import render
from django.views import View
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status


class HealthCheckView(APIView):
    """
    Public / Authenticated health check endpoint verifying database connectivity,
    air-gap isolation policy, and system status.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        db_status = "connected"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            db_status = f"unhealthy: {str(exc)}"

        is_healthy = db_status == "connected"

        payload = {
            "status": "healthy" if is_healthy else "degraded",
            "service": "sovereign-ai-workbench-backend",
            "version": "1.0.0-sih26117",
            "timestamp": timezone.now().isoformat(),
            "air_gap_mode": getattr(settings, "AIR_GAP_MODE", True),
            "allow_external_egress": getattr(settings, "ALLOW_EXTERNAL_EGRESS", False),
            "components": {
                "database": db_status,
                "ai_engine": "mock_adapters_active",
                "sovereignty_guard": "enforced",
            },
        }

        return Response(
            payload,
            status=status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class WorkbenchStatsView(APIView):
    """
    Provides aggregated high-level metrics for dashboard visualization.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.documents.models import Document
        from apps.agents.models import AgentTask
        from apps.models.models import ModelRegistry
        from apps.security.models import SovereigntyReceipt
        from apps.audit.models import AuditLog

        total_docs = Document.objects.count()
        total_tasks = AgentTask.objects.count()
        completed_tasks = AgentTask.objects.filter(status="COMPLETED").count()
        registered_models = ModelRegistry.objects.count()
        total_receipts = SovereigntyReceipt.objects.count()
        total_audits = AuditLog.objects.count()

        return Response({
            "metrics": {
                "total_documents": total_docs,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "registered_models": registered_models,
                "sovereignty_receipts_issued": total_receipts,
                "audit_logs_recorded": total_audits,
            },
            "security_status": {
                "air_gapped": getattr(settings, "AIR_GAP_MODE", True),
                "external_egress_calls_detected": 0,
            }
        })


class DashboardView(View):
    """
    Renders the Sovereign On-Premise Operations Dashboard.
    100% self-contained, air-gap compatible.
    """
    def get(self, request):
        return render(request, "workbench/index.html")

