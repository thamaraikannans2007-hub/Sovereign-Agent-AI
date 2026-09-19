from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role


class AccountsAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@sovereign.local",
            password="SecurePassword123!",
            role=Role.ADMIN,
        )
        self.operator_user = User.objects.create_user(
            username="operator_user",
            email="operator@sovereign.local",
            password="SecurePassword123!",
            role=Role.OPERATOR,
        )

    def test_user_roles_properties(self):
        self.assertTrue(self.admin_user.is_admin_role)
        self.assertTrue(self.admin_user.is_engineer_role)
        self.assertFalse(self.operator_user.is_admin_role)
        self.assertFalse(self.operator_user.is_engineer_role)

    def test_jwt_token_obtain_and_refresh(self):
        # 1. Obtain token
        obtain_res = self.client.post(
            "/api/auth/token/",
            {"username": "admin_user", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(obtain_res.status_code, status.HTTP_200_OK)
        tokens = obtain_res.json()
        self.assertIn("access", tokens)
        self.assertIn("refresh", tokens)

        # 2. Access /api/users/me/ with access token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        me_res = self.client.get("/api/users/me/")
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.json()["username"], "admin_user")
        self.assertEqual(me_res.json()["role"], "Admin")

        # 3. Refresh token
        refresh_res = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_res.json())

    def test_unauthenticated_request_rejected(self):
        response = self.client.get("/api/users/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
