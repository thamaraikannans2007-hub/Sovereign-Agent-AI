import uuid
from django.db import models


class ModelProvider(models.TextChoices):
    LOCAL_OLLAMA = "OLLAMA", "Local Ollama"
    LOCAL_VLLM = "VLLM", "Local vLLM Server"
    LOCAL_LLAMACPP = "LLAMACPP", "Local llama.cpp"
    HUGGINGFACE_LOCAL = "HUGGINGFACE_LOCAL", "HuggingFace Local Pipeline"
    MOCK = "MOCK", "Deterministic Mock Adapter (Zero GPU)"


class ModelType(models.TextChoices):
    LLM = "LLM", "Large Language Model"
    VISION = "VISION", "Vision Multimodal LLM"
    EMBEDDING = "EMBEDDING", "Embedding Model"
    VECTOR_DB = "VECTOR_DB", "Vector Database Engine"


class ModelStatus(models.TextChoices):
    ONLINE = "ONLINE", "Online & Ready"
    OFFLINE = "OFFLINE", "Offline"
    STANDBY = "STANDBY", "Standby / Loading"


class ModelRegistry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, help_text="e.g. llama-3.3-70b-instruct, qwen-2.5-vl")
    provider = models.CharField(max_length=50, choices=ModelProvider.choices, default=ModelProvider.MOCK)
    model_type = models.CharField(max_length=50, choices=ModelType.choices, default=ModelType.LLM)
    endpoint = models.CharField(max_length=255, blank=True, help_text="Local endpoint e.g. http://127.0.0.1:11434")
    status = models.CharField(max_length=20, choices=ModelStatus.choices, default=ModelStatus.ONLINE)
    capabilities = models.JSONField(default=dict, blank=True, help_text="Context window, quant level, modalities")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["model_type", "name"]
        verbose_name = "Model Registry Entry"
        verbose_name_plural = "Model Registry"

    def __str__(self):
        return f"{self.name} [{self.model_type}] - {self.status}"
