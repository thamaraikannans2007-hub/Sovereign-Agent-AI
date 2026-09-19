import io
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.documents.models import Document


class DocumentVaultTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.engineer = User.objects.create_user(
            username="engineer_bob",
            email="bob@sovereign.local",
            password="Password123!",
            role=Role.ENGINEER,
        )
        self.operator = User.objects.create_user(
            username="operator_tom",
            email="tom@sovereign.local",
            password="Password123!",
            role=Role.OPERATOR,
        )

    def test_document_upload_and_metadata(self):
        self.client.force_authenticate(user=self.engineer)
        file_content = b"Confidential Blueprint Specification v1.0 - SIH26117"
        uploaded_file = SimpleUploadedFile(
            "blueprint.txt", file_content, content_type="text/plain"
        )

        response = self.client.post(
            "/api/documents/",
            {"name": "Turbine Specification", "file": uploaded_file},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        doc_data = response.json()
        self.assertEqual(doc_data["name"], "Turbine Specification")
        self.assertEqual(doc_data["uploaded_by_username"], "engineer_bob")
        self.assertEqual(doc_data["type"], "txt")
        self.assertEqual(doc_data["size"], len(file_content))

    def test_operator_forbidden_from_upload(self):
        self.client.force_authenticate(user=self.operator)
        uploaded_file = SimpleUploadedFile("notes.txt", b"Operator notes", content_type="text/plain")
        response = self.client.post(
            "/api/documents/",
            {"name": "Operator notes", "file": uploaded_file},
            format="multipart",
        )
        # Operators don't satisfy IsAnalystOrAbove permission
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
