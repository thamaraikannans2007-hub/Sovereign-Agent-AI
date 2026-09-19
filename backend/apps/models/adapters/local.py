import json
import logging
import urllib.request
import urllib.parse
import urllib.error
from typing import Any, Dict, Optional
from django.conf import settings
from .base import BaseLLMAdapter
from .mock import MockLLMAdapter

logger = logging.getLogger("apps.models.adapters")


class AirGapViolationException(Exception):
    """Raised when an adapter attempts to communicate with a non-whitelisted external network host."""
    pass


def validate_air_gap_host(endpoint_url: str):
    """
    Strictly verifies that outbound socket calls only target local loopback interfaces
    (127.0.0.1, localhost) when AIR_GAP_MODE is enabled.
    """
    if not getattr(settings, "AIR_GAP_MODE", True):
        return

    parsed = urllib.parse.urlparse(endpoint_url)
    hostname = (parsed.hostname or "").lower()
    
    whitelisted_hosts = {"127.0.0.1", "localhost", "::1"}
    if hostname not in whitelisted_hosts:
        raise AirGapViolationException(
            f"AIR-GAP VIOLATION: Outbound network egress to '{hostname}' is strictly prohibited. "
            f"Allowed local interfaces: {whitelisted_hosts}"
        )


class LocalOllamaAdapter(BaseLLMAdapter):
    """
    On-premise adapter communicating with local Ollama daemon (default: http://127.0.0.1:11434).
    Validates air-gap loopback boundaries before socket transmission.
    Falls back gracefully to deterministic mock if the local daemon is not running.
    """

    def __init__(self, model_name: str = "deepseek-r1-distill-70b", endpoint: str = "http://127.0.0.1:11434"):
        self.model_name = model_name
        self.endpoint = endpoint.rstrip("/")

    def generate(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 512, **kwargs) -> Dict[str, Any]:
        target_url = f"{self.endpoint}/api/generate"
        validate_air_gap_host(target_url)

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        if system_prompt:
            payload["system"] = system_prompt

        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            target_url,
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                return {
                    "model": self.model_name,
                    "provider": "LOCAL_OLLAMA",
                    "prompt_length": len(prompt),
                    "response": resp_json.get("response", ""),
                    "tokens_used": resp_json.get("eval_count", len(prompt.split())),
                    "external_egress": False,
                    "air_gap_verified": True,
                }
        except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError) as exc:
            logger.info(f"Local Ollama socket ({self.endpoint}) unavailable ({exc}). Using deterministic sovereign fallback.")
            mock = MockLLMAdapter(model_name=self.model_name)
            res = mock.generate(prompt=prompt, system_prompt=system_prompt, max_tokens=max_tokens, **kwargs)
            res["provider"] = "OLLAMA (Mock Fallback - Local Daemon Offline)"
            res["air_gap_verified"] = True
            return res


class LocalVLLMAdapter(BaseLLMAdapter):
    """
    On-premise adapter communicating with local vLLM OpenAI-compatible server.
    Validates air-gap loopback boundaries before socket transmission.
    Falls back gracefully to deterministic mock if the local daemon is not running.
    """

    def __init__(self, model_name: str = "llama-3.3-70b-industrial", endpoint: str = "http://127.0.0.1:8000/v1"):
        self.model_name = model_name
        self.endpoint = endpoint.rstrip("/")

    def generate(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 512, **kwargs) -> Dict[str, Any]:
        target_url = f"{self.endpoint}/chat/completions"
        validate_air_gap_host(target_url)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        req_data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            target_url,
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                choice = resp_json.get("choices", [{}])[0]
                text = choice.get("message", {}).get("content", "")
                return {
                    "model": self.model_name,
                    "provider": "LOCAL_VLLM",
                    "prompt_length": len(prompt),
                    "response": text,
                    "tokens_used": resp_json.get("usage", {}).get("total_tokens", len(prompt.split())),
                    "external_egress": False,
                    "air_gap_verified": True,
                }
        except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError) as exc:
            logger.info(f"Local vLLM socket ({self.endpoint}) unavailable ({exc}). Using deterministic sovereign fallback.")
            mock = MockLLMAdapter(model_name=self.model_name)
            res = mock.generate(prompt=prompt, system_prompt=system_prompt, max_tokens=max_tokens, **kwargs)
            res["provider"] = "VLLM (Mock Fallback - Local Daemon Offline)"
            res["air_gap_verified"] = True
            return res
