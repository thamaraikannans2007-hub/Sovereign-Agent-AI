from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.audit.models import AuditLog


class AuditLoggingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="security_admin",
            email="sec@sovereign.local",
            password="Password123!",
            role=Role.ADMIN,
        )
        self.engineer = User.objects.create_user(
            username="eng_alice",
            email="alice@sovereign.local",
            password="Password123!",
            role=Role.ENGINEER,
        )

    def test_direct_audit_log_creation(self):
        log = AuditLog.objects.create(
            user=self.engineer,
            action="MODEL_INSPECTION",
            resource="ModelRegistry",
            metadata={"model_name": "mock-llama3"},
            ip_address="127.0.0.1",
        )
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(log.user.username, "eng_alice")
        self.assertEqual(log.action, "MODEL_INSPECTION")

    def test_audit_log_endpoint_admin_access(self):
        AuditLog.objects.create(
            user=self.engineer,
            action="CONFIG_CHANGE",
            resource="Tool",
            metadata={"tool": "cad_parser"},
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/audit/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.json()), 1)

    def test_non_admin_cannot_access_audit_logs(self):
        self.client.force_authenticate(user=self.engineer)
        response = self.client.get("/api/audit/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
