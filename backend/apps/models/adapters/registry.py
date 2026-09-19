import logging
from typing import Optional
from .base import (
    BaseLLMAdapter,
    BaseVisionAdapter,
    BaseEmbeddingAdapter,
    BaseVectorDBAdapter,
    BaseAgentOrchestrator,
)
from .mock import (
    MockLLMAdapter,
    MockVisionAdapter,
    MockEmbeddingAdapter,
    MockVectorDBAdapter,
    MockAgentOrchestrator,
)
from .local import LocalOllamaAdapter, LocalVLLMAdapter

logger = logging.getLogger("apps.models.adapters")


class AdapterRegistry:
    """
    Central factory for instantiating AI adapters.
    Ensures modularity: when real on-premise engines (vLLM, Ollama, llama.cpp, Qdrant)
    are hooked up, no business logic or API contracts change.
    """

    _vector_db_singleton: Optional[BaseVectorDBAdapter] = None

    @classmethod
    def get_llm_adapter(
        cls,
        provider: str = "MOCK",
        model_name: str = "sovereign-llm",
        endpoint: Optional[str] = None,
    ) -> BaseLLMAdapter:
        if provider in ("OLLAMA", "LOCAL_OLLAMA"):
            ep = endpoint or "http://127.0.0.1:11434"
            return LocalOllamaAdapter(model_name=model_name, endpoint=ep)
        elif provider in ("VLLM", "LOCAL_VLLM"):
            ep = endpoint or "http://127.0.0.1:8000/v1"
            return LocalVLLMAdapter(model_name=model_name, endpoint=ep)
        return MockLLMAdapter(model_name=model_name)

    @classmethod
    def get_vision_adapter(cls, provider: str = "MOCK", model_name: str = "sovereign-vision") -> BaseVisionAdapter:
        if provider == "MOCK":
            return MockVisionAdapter(model_name=model_name)
        return MockVisionAdapter(model_name=model_name)

    @classmethod
    def get_embedding_adapter(cls, provider: str = "MOCK", dimension: int = 384) -> BaseEmbeddingAdapter:
        if provider == "MOCK":
            return MockEmbeddingAdapter(dimension=dimension)
        return MockEmbeddingAdapter(dimension=dimension)

    @classmethod
    def get_vector_db_adapter(cls, provider: str = "MOCK") -> BaseVectorDBAdapter:
        if cls._vector_db_singleton is None:
            cls._vector_db_singleton = MockVectorDBAdapter()
        return cls._vector_db_singleton

    @classmethod
    def get_orchestrator(cls, model_name: str = "sovereign-agent-core") -> BaseAgentOrchestrator:
        llm_adapter = cls.get_llm_adapter(provider="MOCK", model_name=model_name)
        return MockAgentOrchestrator(llm_adapter=llm_adapter)

    @classmethod
    def get_rag_pipeline(cls, knowledge_base_id: str):
        """
        Returns a (SovereignRAGIndexer, SovereignRAGRetriever) tuple for the given KB.
        All operations are local — zero external network calls.
        """
        from apps.knowledge.rag import SovereignRAGIndexer, SovereignRAGRetriever
        indexer = SovereignRAGIndexer(knowledge_base_id=knowledge_base_id)
        retriever = SovereignRAGRetriever(knowledge_base_id=knowledge_base_id)
        return indexer, retriever
