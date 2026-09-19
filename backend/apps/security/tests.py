from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.agents.models import AgentTask
from apps.security.models import SovereigntyReceipt
from apps.security.receipts import generate_sovereignty_receipt, verify_receipt_integrity


class SovereigntyReceiptTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="analyst_claire",
            email="claire@sovereign.local",
            password="Password123!",
            role=Role.ANALYST,
        )
        self.task = AgentTask.objects.create(
            user=self.user,
            task_type="DEFENSE_COMPONENT_ANALYSIS",
            input={"prompt": "Classify turbine material alloy"},
        )

    def test_receipt_creation_and_hash_verification(self):
        receipt = generate_sovereignty_receipt(
            task=self.task,
            models_used=["mock-llama3-industrial"],
            files_accessed=["vault/specs/alloy_spec.pdf"],
            tools_used=["cad_parser"],
            external_requests=0,
            network_status="AIR_GAPPED_LOCAL",
        )

        self.assertIsNotNone(receipt.integrity_hash)
        self.assertEqual(len(receipt.integrity_hash), 64)  # SHA-256 hex length

        # Verify integrity using receipt verifier
        verification = verify_receipt_integrity(receipt)
        self.assertTrue(verification["is_valid"])
        self.assertTrue(verification["is_air_gapped"])
        self.assertEqual(verification["compliance_status"], "SOVEREIGN_COMPLIANT")

    def test_tamper_detection(self):
        receipt = generate_sovereignty_receipt(
            task=self.task,
            models_used=["mock-llama3-industrial"],
            files_accessed=[],
            tools_used=[],
            external_requests=0,
        )

        # Tamper with the receipt by secretly simulating an external leak
        receipt.external_requests = 1
        # Re-verify without updating hash
        verification = verify_receipt_integrity(receipt)
        self.assertFalse(verification["is_valid"])
        self.assertEqual(verification["compliance_status"], "VIOLATION_DETECTED")

    def test_receipt_verify_api_endpoint(self):
        receipt = generate_sovereignty_receipt(
            task=self.task,
            models_used=["mock-llama3-industrial"],
            files_accessed=[],
            tools_used=[],
            external_requests=0,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/receipts/{receipt.id}/verify/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["is_valid"])
        self.assertEqual(data["compliance_status"], "SOVEREIGN_COMPLIANT")
