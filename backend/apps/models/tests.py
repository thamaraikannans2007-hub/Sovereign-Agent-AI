from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, Role
from apps.models.models import ModelRegistry, ModelProvider, ModelType, ModelStatus
from apps.models.adapters.registry import AdapterRegistry


class AIAdaptersAndRegistryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.engineer = User.objects.create_user(
            username="eng_dave",
            email="dave@sovereign.local",
            password="Password123!",
            role=Role.ENGINEER,
        )

    def test_mock_llm_adapter(self):
        adapter = AdapterRegistry.get_llm_adapter(provider="MOCK", model_name="llama-3.3-70b-airgap")
        res = adapter.generate("Classify vibration frequency data")
        self.assertIn("SOVEREIGN AIR-GAPPED RESPONSE", res["response"])
        self.assertFalse(res["external_egress"])

    def test_mock_embedding_and_vector_db(self):
        emb_adapter = AdapterRegistry.get_embedding_adapter(dimension=128)
        vec1 = emb_adapter.embed_text("Turbine pressure gauge high")
        vec2 = emb_adapter.embed_text("Turbine pressure gauge critical")
        self.assertEqual(len(vec1), 128)

        vdb = AdapterRegistry.get_vector_db_adapter()
        vdb.insert("telemetry", "doc_1", vec1, {"title": "Doc 1"})
        results = vdb.query("telemetry", vec2, top_k=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "doc_1")

    def test_model_registry_ping_action(self):
        model = ModelRegistry.objects.create(
            name="local-qwen-industrial",
            provider=ModelProvider.MOCK,
            model_type=ModelType.LLM,
            status=ModelStatus.ONLINE,
        )
        self.client.force_authenticate(user=self.engineer)
        res = self.client.post(f"/api/models/{model.id}/ping/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["status"], "ready")
