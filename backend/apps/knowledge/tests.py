"""
Sovereign RAG Pipeline Tests
Tests for ChunkingEngine, SovereignRAGIndexer, SovereignRAGRetriever,
and the /index/ and /retrieve/ API endpoints.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class ChunkingEngineTests(TestCase):
    """Tests for the local text ChunkingEngine."""

    def setUp(self):
        from apps.knowledge.rag import ChunkingEngine
        self.engine = ChunkingEngine(chunk_size=10, overlap=2)

    def test_splits_text_into_multiple_chunks(self):
        text = " ".join([f"word{i}" for i in range(30)])
        chunks = self.engine.split(text, source_name="test_doc")
        # With chunk_size=10, overlap=2, step=8: 30 words -> 4 chunks
        self.assertGreater(len(chunks), 1)

    def test_chunk_dict_structure(self):
        text = " ".join([f"word{i}" for i in range(20)])
        chunks = self.engine.split(text, source_name="blueprint.pdf")
        for c in chunks:
            self.assertIn("chunk_index", c)
            self.assertIn("content", c)
            self.assertIn("source_name", c)
            self.assertEqual(c["source_name"], "blueprint.pdf")

    def test_empty_text_returns_empty_list(self):
        chunks = self.engine.split("", source_name="empty")
        self.assertEqual(chunks, [])

    def test_short_text_single_chunk(self):
        text = "Only three words"
        chunks = self.engine.split(text, source_name="short")
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["content"], text)

    def test_chunk_indices_sequential(self):
        text = " ".join([f"word{i}" for i in range(50)])
        chunks = self.engine.split(text)
        indices = [c["chunk_index"] for c in chunks]
        self.assertEqual(indices, list(range(len(chunks))))


class RAGIndexerRetrieverTests(TestCase):
    """Tests for SovereignRAGIndexer and SovereignRAGRetriever."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="rag_test_user", password="test1234", role="Analyst"
        )
        from apps.knowledge.models import KnowledgeBase
        self.kb = KnowledgeBase.objects.create(
            name="Test Reactor Protocols",
            description="Test knowledge base for RAG testing",
            created_by=self.user,
        )

    def test_indexer_creates_chunks_in_db(self):
        from apps.knowledge.rag import SovereignRAGIndexer
        from apps.knowledge.models import KnowledgeChunk
        indexer = SovereignRAGIndexer(knowledge_base_id=str(self.kb.id))
        text = (
            "Turbine rotor material specification: Inconel 718 alloy with tensile "
            "strength above 180 ksi. Operating temperature range 400-650 degrees Celsius. "
            "Weld seam inspection requires ultrasonic NDT every 2000 hours. "
            "Secondary coolant circuit pressure threshold is 140 bar. "
            "Any pressure exceeding 150 bar triggers automatic SCRAM protocol."
        )
        count = indexer.index_text(text=text, source_name="turbine_spec.pdf")
        self.assertGreater(count, 0)

        # Verify DB records were created
        db_chunks = KnowledgeChunk.objects.filter(knowledge_base=self.kb)
        self.assertEqual(db_chunks.count(), count)

        # Verify KB is marked as indexed
        self.kb.refresh_from_db()
        self.assertTrue(self.kb.rag_indexed)
        self.assertEqual(self.kb.chunk_count, count)

    def test_retriever_returns_relevant_chunks(self):
        from apps.knowledge.rag import SovereignRAGIndexer, SovereignRAGRetriever
        indexer = SovereignRAGIndexer(knowledge_base_id=str(self.kb.id))
        text = (
            "Coolant pressure anomaly detected at 145 bar. "
            "Emergency valve closure initiated. SCRAM activated. "
            "Turbine rotor temperature within normal range."
        )
        indexer.index_text(text=text, source_name="scada_log.csv")

        retriever = SovereignRAGRetriever(knowledge_base_id=str(self.kb.id), top_k=3)
        results = retriever.retrieve("coolant pressure emergency")
        self.assertGreater(len(results), 0)

        # Validate result structure
        for r in results:
            self.assertIn("chunk_id", r)
            self.assertIn("score", r)
            self.assertIn("content", r)
            self.assertIn("source_document_name", r)

    def test_retriever_empty_query_returns_empty(self):
        from apps.knowledge.rag import SovereignRAGRetriever
        retriever = SovereignRAGRetriever(knowledge_base_id=str(self.kb.id), top_k=3)
        results = retriever.retrieve("")
        self.assertEqual(results, [])

    def test_rehydrate_restores_vector_store(self):
        from apps.knowledge.rag import SovereignRAGIndexer, SovereignRAGRetriever
        indexer = SovereignRAGIndexer(knowledge_base_id=str(self.kb.id))
        indexer.index_text("test content for rehydration check", source_name="test.txt")

        # Rehydrate should not raise
        indexer.rehydrate_from_db()

        # And retrieval should still work
        retriever = SovereignRAGRetriever(knowledge_base_id=str(self.kb.id), top_k=3)
        results = retriever.retrieve("rehydration content")
        self.assertIsInstance(results, list)


class KnowledgeBaseAPITests(TestCase):
    """Tests for /api/knowledge/{id}/index/ and /retrieve/ endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="analyst_rag", password="AnalystRAG2026!", role="Analyst"
        )
        # Obtain JWT token
        token_res = self.client.post(
            "/api/auth/token/",
            {"username": "analyst_rag", "password": "AnalystRAG2026!"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token_res.data['access']}"
        )

        from apps.knowledge.models import KnowledgeBase
        self.kb = KnowledgeBase.objects.create(
            name="API Test Knowledge Base",
            description="Used for endpoint testing",
            created_by=self.user,
        )

    def test_index_endpoint_returns_200_and_chunk_count(self):
        res = self.client.post(
            f"/api/knowledge/{self.kb.id}/index/",
            {"text": "Industrial gas turbine operating specifications and safety thresholds."},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertGreater(res.data["chunks_indexed"], 0)
        self.assertTrue(res.data["rag_indexed"])

    def test_index_endpoint_with_no_text_uses_fallback(self):
        res = self.client.post(
            f"/api/knowledge/{self.kb.id}/index/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertGreater(res.data["chunks_indexed"], 0)

    def test_retrieve_endpoint_requires_indexed_kb(self):
        res = self.client.post(
            f"/api/knowledge/{self.kb.id}/retrieve/",
            {"query": "turbine specification"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

    def test_retrieve_endpoint_returns_chunks_after_indexing(self):
        # Index first
        self.client.post(
            f"/api/knowledge/{self.kb.id}/index/",
            {"text": "Reactor safety valve specification. Emergency coolant circuit."},
            format="json",
        )
        # Now retrieve
        res = self.client.post(
            f"/api/knowledge/{self.kb.id}/retrieve/",
            {"query": "safety valve coolant"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertIsInstance(res.data["results"], list)
        self.assertEqual(res.data["external_egress"], False)
        self.assertEqual(res.data["network_status"], "AIR_GAPPED_LOCAL")

    def test_retrieve_endpoint_requires_query(self):
        # Index first
        self.client.post(
            f"/api/knowledge/{self.kb.id}/index/",
            {"text": "Some content"},
            format="json",
        )
        res = self.client.post(
            f"/api/knowledge/{self.kb.id}/retrieve/",
            {"query": ""},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_chunks_endpoint_lists_indexed_chunks(self):
        self.client.post(
            f"/api/knowledge/{self.kb.id}/index/",
            {"text": "Weld seam porosity analysis using phased array ultrasonic testing."},
            format="json",
        )
        res = self.client.get(f"/api/knowledge/{self.kb.id}/chunks/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("chunk_count", res.data)
        self.assertGreater(res.data["chunk_count"], 0)
