from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseLLMAdapter(ABC):
    """Abstract interface for local sovereign text LLMs (e.g. Llama 3, Mistral, Qwen)."""

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 512, **kwargs) -> Dict[str, Any]:
        """Generates text output locally without internet access."""
        pass


class BaseVisionAdapter(ABC):
    """Abstract interface for local sovereign vision multimodal LLMs (e.g. Qwen2-VL, Llama-3.2-Vision)."""

    @abstractmethod
    def analyze_image(self, image_path: str, prompt: str, **kwargs) -> Dict[str, Any]:
        """Analyzes an industrial diagram, CAD export, or document visually."""
        pass


class BaseEmbeddingAdapter(ABC):
    """Abstract interface for local sovereign embedding models (e.g. BGE-M3, Nomic)."""

    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Computes dense vector representation for text."""
        pass


class BaseVectorDBAdapter(ABC):
    """Abstract interface for local on-premise vector databases (e.g. Qdrant, Milvus, Chroma, pgvector)."""

    @abstractmethod
    def insert(self, collection_name: str, doc_id: str, vector: List[float], metadata: Dict[str, Any]) -> bool:
        """Inserts an embedding and metadata into an on-premise vector store."""
        pass

    @abstractmethod
    def query(self, collection_name: str, vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Queries nearest neighbors from the on-premise vector store."""
        pass


class BaseAgentOrchestrator(ABC):
    """Abstract interface for orchestrating multi-step sovereign industrial workflows."""

    @abstractmethod
    def plan_and_execute(
        self,
        task_type: str,
        input_data: Dict[str, Any],
        tools: List[str],
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Executes an agent workflow deterministically with verifiable step tracking."""
        pass
