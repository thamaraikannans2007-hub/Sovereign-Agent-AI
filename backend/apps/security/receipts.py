import hashlib
import json
from typing import Any, Dict, List
from .models import SovereigntyReceipt
from apps.agents.models import AgentTask


def calculate_receipt_hash(
    task_id: str,
    models_used: List[str],
    files_accessed: List[str],
    tools_used: List[str],
    external_requests: int,
    network_status: str,
) -> str:
    """
    Computes a canonical SHA-256 integrity hash for a task execution receipt.
    """
    payload = {
        "task_id": str(task_id),
        "models_used": sorted(models_used),
        "files_accessed": sorted(files_accessed),
        "tools_used": sorted(tools_used),
        "external_requests": int(external_requests),
        "network_status": str(network_status),
    }
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def generate_sovereignty_receipt(
    task: AgentTask,
    models_used: List[str],
    files_accessed: List[str],
    tools_used: List[str],
    external_requests: int = 0,
    network_status: str = "AIR_GAPPED_LOCAL",
) -> SovereigntyReceipt:
    """
    Creates and cryptographically seals a SovereigntyReceipt in the database.
    """
    integrity_hash = calculate_receipt_hash(
        task_id=task.task_id,
        models_used=models_used,
        files_accessed=files_accessed,
        tools_used=tools_used,
        external_requests=external_requests,
        network_status=network_status,
    )

    receipt = SovereigntyReceipt.objects.create(
        task=task,
        models_used=models_used,
        files_accessed=files_accessed,
        tools_used=tools_used,
        external_requests=external_requests,
        network_status=network_status,
        integrity_hash=integrity_hash,
    )
    return receipt


def verify_receipt_integrity(receipt: SovereigntyReceipt) -> Dict[str, Any]:
    """
    Recalculates the SHA-256 integrity hash and verifies that the receipt
    has not been tampered with and satisfies sovereign zero-egress compliance.
    """
    recalculated_hash = calculate_receipt_hash(
        task_id=receipt.task.task_id,
        models_used=receipt.models_used,
        files_accessed=receipt.files_accessed,
        tools_used=receipt.tools_used,
        external_requests=receipt.external_requests,
        network_status=receipt.network_status,
    )

    is_valid = recalculated_hash == receipt.integrity_hash
    is_air_gapped = receipt.external_requests == 0 and "AIR_GAPPED" in receipt.network_status

    return {
        "is_valid": is_valid,
        "is_air_gapped": is_air_gapped,
        "recorded_hash": receipt.integrity_hash,
        "computed_hash": recalculated_hash,
        "external_requests": receipt.external_requests,
        "compliance_status": "SOVEREIGN_COMPLIANT" if (is_valid and is_air_gapped) else "VIOLATION_DETECTED",
    }
