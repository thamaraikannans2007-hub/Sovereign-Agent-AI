import math
import hashlib
from typing import Any, Dict, List, Optional
from .base import (
    BaseLLMAdapter,
    BaseVisionAdapter,
    BaseEmbeddingAdapter,
    BaseVectorDBAdapter,
    BaseAgentOrchestrator,
)


class MockLLMAdapter(BaseLLMAdapter):
    """
    Deterministic mock adapter enabling backend development, testing,
    and verification without requiring local GPU or model weights.
    """

    def __init__(self, model_name: str = "mock-llama3-industrial"):
        self.model_name = model_name

    def generate(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 512, **kwargs) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "provider": "MOCK",
            "prompt_length": len(prompt),
            "response": (
                f"[SOVEREIGN AIR-GAPPED RESPONSE from {self.model_name}]\n"
                f"Analysis completed successfully for confidential input query.\n"
                f"Findings: Input verified under zero-egress perimeter.\n"
                f"Prompt summary: '{prompt[:100]}...'"
            ),
            "tokens_used": min(len(prompt.split()) + 32, max_tokens),
            "external_egress": False,
        }


class MockVisionAdapter(BaseVisionAdapter):
    """Deterministic mock adapter for visual inspection tasks."""

    def __init__(self, model_name: str = "mock-qwen2-vl-industrial"):
        self.model_name = model_name

    def analyze_image(self, image_path: str, prompt: str, **kwargs) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "provider": "MOCK",
            "image_path": image_path,
            "analysis": {
                "detected_objects": ["industrial_piping", "valve_assembly", "weld_seam"],
                "anomaly_detected": False,
                "confidence_score": 0.965,
                "inspection_summary": "Structure complies with sovereign industrial standards. No structural degradation identified.",
            },
            "external_egress": False,
        }


class MockEmbeddingAdapter(BaseEmbeddingAdapter):
    """Deterministic mock adapter computing pseudo-embeddings (dimension=384) from text hash."""

    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def embed_text(self, text: str) -> List[float]:
        # Generate deterministic vector based on MD5 digest bytes
        digest = hashlib.md5(text.encode("utf-8")).digest()
        raw_vals = [((digest[i % len(digest)] / 255.0) * 2.0 - 1.0) for i in range(self.dimension)]
        # Normalize
        norm = math.sqrt(sum(x * x for x in raw_vals)) or 1.0
        return [round(x / norm, 5) for x in raw_vals]


class MockVectorDBAdapter(BaseVectorDBAdapter):
    """In-memory mock vector database with deterministic cosine search."""

    def __init__(self):
        self.collections: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def insert(self, collection_name: str, doc_id: str, vector: List[float], metadata: Dict[str, Any]) -> bool:
        if collection_name not in self.collections:
            self.collections[collection_name] = {}
        self.collections[collection_name][doc_id] = {
            "vector": vector,
            "metadata": metadata,
        }
        return True

    def query(self, collection_name: str, vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        if collection_name not in self.collections:
            return []

        results = []
        for doc_id, entry in self.collections[collection_name].items():
            stored_vector = entry["vector"]
            # Cosine similarity
            dot = sum(a * b for a, b in zip(vector, stored_vector))
            norm_a = math.sqrt(sum(a * a for a in vector)) or 1.0
            norm_b = math.sqrt(sum(b * b for b in stored_vector)) or 1.0
            score = dot / (norm_a * norm_b)
            results.append({
                "id": doc_id,
                "score": round(score, 4),
                "metadata": entry["metadata"],
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]


class MockAgentOrchestrator(BaseAgentOrchestrator):
    """Deterministic sovereign agent workflow orchestrator with optional RAG grounding."""

    def __init__(self, llm_adapter: Optional[BaseLLMAdapter] = None):
        self.llm_adapter = llm_adapter or MockLLMAdapter()

    def plan_and_execute(
        self,
        task_type: str,
        input_data: Dict[str, Any],
        tools: List[str],
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        prompt = input_data.get("prompt", f"Run {task_type}")
        knowledge_base_id = input_data.get("knowledge_base_id")

        steps = [
            {"step": 1, "action": "Task Initiation", "status": "COMPLETED",
             "detail": f"Initialized sovereign task type: {task_type}"},
            {"step": 2, "action": "Tool Permission Validation", "status": "COMPLETED",
             "tools_authorized": tools},
        ]

        rag_chunks = []
        rag_context = ""

        # --- RAG Retrieval Step (if knowledge_base_id provided) ---
        if knowledge_base_id:
            try:
                from apps.knowledge.rag import SovereignRAGIndexer, SovereignRAGRetriever, build_rag_context
                # Rehydrate vector store from DB on each orchestration call
                indexer = SovereignRAGIndexer(knowledge_base_id=str(knowledge_base_id))
                indexer.rehydrate_from_db()
                retriever = SovereignRAGRetriever(knowledge_base_id=str(knowledge_base_id), top_k=3)
                rag_chunks = retriever.retrieve(prompt)
                rag_context = build_rag_context(rag_chunks)
                steps.append({
                    "step": 3,
                    "action": "RAG Context Retrieval",
                    "status": "COMPLETED",
                    "chunks_retrieved": len(rag_chunks),
                    "top_scores": [round(c["score"], 4) for c in rag_chunks],
                    "sources": list({c["source_document_name"] for c in rag_chunks}),
                })
            except Exception as exc:
                steps.append({
                    "step": 3,
                    "action": "RAG Context Retrieval",
                    "status": "SKIPPED",
                    "detail": f"KB retrieval unavailable: {exc}",
                })
        else:
            steps.append({
                "step": 3,
                "action": "RAG Context Retrieval",
                "status": "SKIPPED",
                "detail": "No knowledge_base_id provided in task input.",
            })

        # --- LLM Inference Step ---
        grounded_prompt = f"{rag_context}\n\n{prompt}" if rag_context else prompt
        llm_result = self.llm_adapter.generate(prompt=grounded_prompt)
        steps.append({
            "step": 4,
            "action": "Local Inference Execution",
            "status": "COMPLETED",
            "model": llm_result["model"],
            "rag_grounded": bool(rag_context),
            "tokens_used": llm_result.get("tokens_used", 0),
        })

        # --- Sovereignty Verification Step ---
        steps.append({
            "step": 5,
            "action": "Sovereignty Verification",
            "status": "COMPLETED",
            "external_egress_requests": 0,
            "network_confinement": "AIR_GAPPED_LOCAL",
        })

        synthesis = llm_result["response"]
        if rag_chunks:
            synthesis = (
                f"[RAG-GROUNDED ANALYSIS — {len(rag_chunks)} local chunks retrieved]\n\n"
                + synthesis
            )

        return {
            "task_type": task_type,
            "status": "COMPLETED",
            "steps": steps,
            "synthesis": synthesis,
            "models_used": [llm_result["model"]],
            "tools_invoked": tools,
            "rag_chunks_used": len(rag_chunks),
            "rag_sources": list({c["source_document_name"] for c in rag_chunks}),
            "external_egress_detected": False,
        }

