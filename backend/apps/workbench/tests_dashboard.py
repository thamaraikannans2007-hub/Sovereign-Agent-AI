from django.test import TestCase, Client
from django.core.management import call_command
from apps.accounts.models import User, Role
from apps.models.models import ModelRegistry
from apps.tools.models import Tool
from apps.models.adapters.local import (
    validate_air_gap_host,
    AirGapViolationException,
    LocalOllamaAdapter,
    LocalVLLMAdapter,
)


class DashboardViewTests(TestCase):
    """Tests that the air-gapped sovereign workbench web dashboard renders correctly."""

    def setUp(self):
        self.client = Client()

    def test_dashboard_root_url(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "SOVEREIGN AI WORKBENCH")
        self.assertContains(response, "SIH26117")

    def test_dashboard_alias_url(self):
        response = self.client.get("/workbench/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "SOVEREIGN AI WORKBENCH")


class SeedWorkbenchCommandTests(TestCase):
    """Tests the industrial seeder management command."""

    def test_seed_workbench_execution(self):
        call_command("seed_workbench")
        
        # Verify 4 role accounts exist
        self.assertTrue(User.objects.filter(role=Role.ADMIN).exists())
        self.assertTrue(User.objects.filter(role=Role.ENGINEER).exists())
        self.assertTrue(User.objects.filter(role=Role.ANALYST).exists())
        self.assertTrue(User.objects.filter(role=Role.OPERATOR).exists())

        # Verify industrial models and tools are populated
        self.assertTrue(ModelRegistry.objects.filter(name="deepseek-r1-distill-70b").exists())
        self.assertTrue(ModelRegistry.objects.filter(name="llama-3.3-70b-industrial").exists())
        self.assertTrue(Tool.objects.filter(name="cad_stress_analyzer").exists())
        self.assertTrue(Tool.objects.filter(name="sovereignty_receipt_auditor").exists())


class AirGapAndLocalAdapterTests(TestCase):
    """Tests that the air-gap firewall blocks WAN egress and local adapters handle offline daemons."""

    def test_air_gap_firewall_blocks_external_domains(self):
        # Whitelisted local loopbacks should pass without error
        validate_air_gap_host("http://127.0.0.1:11434/api/generate")
        validate_air_gap_host("http://localhost:8000/v1")

        # External WAN targets must trigger AirGapViolationException
        with self.assertRaises(AirGapViolationException):
            validate_air_gap_host("https://api.openai.com/v1/chat/completions")

        with self.assertRaises(AirGapViolationException):
            validate_air_gap_host("https://api.anthropic.com/v1/messages")

        with self.assertRaises(AirGapViolationException):
            validate_air_gap_host("http://198.51.100.1:11434/api/generate")

    def test_local_ollama_fallback_when_offline(self):
        adapter = LocalOllamaAdapter(
            model_name="deepseek-r1-distill-70b",
            endpoint="http://127.0.0.1:54321",  # Unused port
        )
        res = adapter.generate(prompt="Analyze coolant valve stress")
        self.assertEqual(res["model"], "deepseek-r1-distill-70b")
        self.assertIn("Fallback", res["provider"])
        self.assertFalse(res["external_egress"])
        self.assertTrue(res["air_gap_verified"])

    def test_local_vllm_fallback_when_offline(self):
        adapter = LocalVLLMAdapter(
            model_name="llama-3.3-70b-industrial",
            endpoint="http://127.0.0.1:54321/v1",  # Unused port
        )
        res = adapter.generate(prompt="Verify turbine blade resonance")
        self.assertEqual(res["model"], "llama-3.3-70b-industrial")
        self.assertIn("Fallback", res["provider"])
        self.assertFalse(res["external_egress"])
        self.assertTrue(res["air_gap_verified"])
