from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.agents.models import AgentTask, TaskStatus
from apps.security.models import SovereigntyReceipt


class AgentTaskExecutionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.engineer = User.objects.create_user(
            username="eng_eva",
            email="eva@sovereign.local",
            password="Password123!",
            role=Role.ENGINEER,
        )

    def test_task_creation_and_execution_with_receipt(self):
        self.client.force_authenticate(user=self.engineer)
        
        # 1. Create task
        create_res = self.client.post(
            "/api/agents/",
            {
                "task_type": "STRUCTURAL_STRESS_ANALYSIS",
                "input": {"prompt": "Analyze titanium hull weld logs", "tools": ["stress_evaluator"]},
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        task_id = create_res.json()["id"]

        # 2. Run task
        run_res = self.client.post(f"/api/agents/{task_id}/run/")
        self.assertEqual(run_res.status_code, status.HTTP_200_OK)
        run_data = run_res.json()
        self.assertEqual(run_data["task"]["status"], TaskStatus.COMPLETED)
        self.assertIn("receipt", run_data)
        self.assertEqual(run_data["receipt"]["external_requests"], 0)

        # 3. Verify that receipt exists in DB and links to task
        receipt = SovereigntyReceipt.objects.get(id=run_data["receipt"]["receipt_id"])
        self.assertEqual(receipt.task.id, AgentTask.objects.get(id=task_id).id)
        self.assertEqual(receipt.external_requests, 0)
