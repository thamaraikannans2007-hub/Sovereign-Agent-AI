from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status


class HealthCheckTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_endpoint(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["air_gap_mode"])
        self.assertFalse(data["allow_external_egress"])
        self.assertEqual(data["components"]["database"], "connected")
        self.assertEqual(data["components"]["sovereignty_guard"], "enforced")
