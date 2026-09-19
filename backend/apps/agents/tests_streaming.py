"""
Agent Streaming Endpoint Tests
Tests for the /api/agents/{id}/stream/ SSE endpoint.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
import json

User = get_user_model()


class AgentStreamingTests(TestCase):
    """Tests for the SSE streaming task execution endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="stream_engineer", password="StreamEng2026!", role="Engineer"
        )
        token_res = self.client.post(
            "/api/auth/token/",
            {"username": "stream_engineer", "password": "StreamEng2026!"},
            format="json",
        )
        self.token = token_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def _create_task(self, task_type="CONFIDENTIAL_CAD_AUDIT", prompt="Test prompt"):
        """Helper: create a pending agent task via the API."""
        res = self.client.post(
            "/api/agents/",
            {
                "task_type": task_type,
                "input": {
                    "prompt": prompt,
                    "tools": ["cad_stress_analyzer"],
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        return res.data

    def test_stream_endpoint_returns_event_stream_content_type(self):
        task = self._create_task()
        response = self.client.post(
            f"/api/agents/{task['id']}/stream/",
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/event-stream", response["Content-Type"])

    def test_stream_endpoint_emits_sse_frames(self):
        task = self._create_task(prompt="Analyze turbine CAD for fracture risk")
        response = self.client.post(
            f"/api/agents/{task['id']}/stream/",
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Collect all SSE frames
        content = b"".join(response.streaming_content).decode("utf-8")
        self.assertIn("data:", content)

        frames = []
        for line in content.split("\n\n"):
            if line.startswith("data:"):
                try:
                    frames.append(json.loads(line[5:].strip()))
                except json.JSONDecodeError:
                    pass

        self.assertGreater(len(frames), 0)

    def test_stream_emits_task_start_frame(self):
        task = self._create_task()
        response = self.client.post(f"/api/agents/{task['id']}/stream/")
        content = b"".join(response.streaming_content).decode("utf-8")

        frames = [
            json.loads(line[5:].strip())
            for line in content.split("\n\n")
            if line.startswith("data:")
        ]
        events = [f.get("event") for f in frames]
        self.assertIn("task_start", events)

    def test_stream_emits_all_required_steps(self):
        task = self._create_task(prompt="SCADA telemetry anomaly detection")
        response = self.client.post(f"/api/agents/{task['id']}/stream/")
        content = b"".join(response.streaming_content).decode("utf-8")

        frames = [
            json.loads(line[5:].strip())
            for line in content.split("\n\n")
            if line.startswith("data:")
        ]

        step_actions = {
            f["action"] for f in frames if f.get("event") == "step"
        }
        required_steps = {
            "Task Initiation",
            "Tool Permission Validation",
            "RAG Context Retrieval",
            "Local Inference Execution",
            "Sovereignty Verification",
        }
        self.assertEqual(step_actions, required_steps)

    def test_stream_final_frame_contains_sovereignty_receipt(self):
        task = self._create_task(prompt="Weld seam porosity inspection report")
        response = self.client.post(f"/api/agents/{task['id']}/stream/")
        content = b"".join(response.streaming_content).decode("utf-8")

        frames = [
            json.loads(line[5:].strip())
            for line in content.split("\n\n")
            if line.startswith("data:")
        ]

        complete_frames = [f for f in frames if f.get("event") == "task_complete"]
        self.assertEqual(len(complete_frames), 1)

        final = complete_frames[0]
        self.assertIn("receipt", final)
        self.assertIn("integrity_hash", final["receipt"])
        self.assertIn("network_status", final["receipt"])
        self.assertEqual(final["receipt"]["external_requests"], 0)
        self.assertEqual(final["receipt"]["network_status"], "AIR_GAPPED_LOCAL")

    def test_stream_task_status_is_completed_after_stream(self):
        from apps.agents.models import AgentTask, TaskStatus
        task_data = self._create_task()
        response = self.client.post(f"/api/agents/{task_data['id']}/stream/")
        # Consume the stream
        b"".join(response.streaming_content)

        task = AgentTask.objects.get(id=task_data["id"])
        self.assertEqual(task.status, TaskStatus.COMPLETED)

    def test_stream_generates_sovereignty_receipt_in_db(self):
        from apps.security.models import SovereigntyReceipt
        task_data = self._create_task()
        initial_count = SovereigntyReceipt.objects.count()

        response = self.client.post(f"/api/agents/{task_data['id']}/stream/")
        b"".join(response.streaming_content)

        self.assertEqual(SovereigntyReceipt.objects.count(), initial_count + 1)
