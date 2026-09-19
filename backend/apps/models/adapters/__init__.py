"""Modular AI Interfaces and Adapters for Sovereign Air-Gapped Operation."""
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
from .registry import AdapterRegistry

__all__ = [
    "BaseLLMAdapter",
    "BaseVisionAdapter",
    "BaseEmbeddingAdapter",
    "BaseVectorDBAdapter",
    "BaseAgentOrchestrator",
    "MockLLMAdapter",
    "MockVisionAdapter",
    "MockEmbeddingAdapter",
    "MockVectorDBAdapter",
    "MockAgentOrchestrator",
    "AdapterRegistry",
]
