# Architecture Specification: Sovereign On-Premise Agentic AI Workbench

**Project:** Sovereign On-Premise Agentic AI Workbench using Open-Weight Multimodal LLMs for Confidential Industry  
**Problem Statement:** SIH26117  

---

## 1. Executive Summary

Confidential industrial environments (e.g., defense aerospace, nuclear energy, heavy machinery, and critical utilities) operate under stringent air-gap, regulatory, and intellectual property mandates. Commercial cloud-hosted AI engines violate confidentiality by transmitting proprietary schematics, telemetry, and source code outside organizational perimeters.

This backend provides a **sovereign, air-gapped, role-governed agentic AI workbench** foundation. It decouples core orchestrations from specific model backends through modular adapters, issues cryptographically sealed SHA-256 receipts confirming zero external data egress, and implements rigorous RBAC and immutable audit trails.

---

## 2. High-Level System Architecture

```
                                  +-----------------------------+
                                  |     Client Applications     |
                                  | (Web, Industrial Terminals) |
                                  +--------------+--------------+
                                                 |
                                     REST / JWT / WebSocket
                                                 v
                      +----------------------------------------------------+
                      |            Django / DRF Gateway Layer              |
                      |  - JWT Authentication (SimpleJWT)                  |
                      |  - Role-Based Access Control (RBAC)                |
                      |  - Automated Audit Middleware                      |
                      |  - Air-Gap Sovereignty Guard                       |
                      +----+-----------+-----------+------------+----------+
                           |           |           |            |
         +-----------------+           |           |            +-----------------+
         v                             v           v                              v
+------------------+         +-------------+  +------------+             +------------------+
|  apps.documents  |         | apps.agents |  |apps.knowl. |             |  apps.security   |
| Confidential     |         | Task State  |  | Confidential             | Sovereignty      |
| Document Vault   |         | Engine      |  | Catalog    |             | Receipts (SHA256)|
+------------------+         +------+------+  +------------+             +------------------+
                                    |
                                    v
            +------------------------------------------------------+
            |              Modular AI Adapter Layer                |
            |               (apps.models.adapters)                 |
            +----------+----------------+---------------+----------+
                       |                |               |
                       v                v               v
            +------------------+ +-------------+ +---------------+
            |  Local Text LLM  | | Vision LLM  | | Embedding &   |
            | (vLLM / Ollama)  | | (Qwen2-VL)  | | Local Vector  |
            +------------------+ +-------------+ +---------------+
                                       |
                       (Dev: Deterministic Mock Adapters)
                                       |
                                       v
                     +-----------------------------------+
                     |       PostgreSQL Database         |
                     |  (Dev: SQLite zero-config fallback)|
                     +-----------------------------------+
```

---

## 3. Core Modules & Responsibilities

| Module | Location | Purpose |
|---|---|---|
| **Configuration** | `config/` | Environment settings (`base`, `development`, `production`), WSGI/ASGI handlers, global URLs, uniform exception handling. |
| **Accounts** | `apps/accounts/` | Custom `User` model with UUID keys, 4-tier Role taxonomy (`Admin`, `Engineer`, `Analyst`, `Operator`), JWT token issuance/refresh. |
| **Workbench** | `apps/workbench/` | System status verification, database ping, air-gap configuration telemetry, high-level metrics. |
| **Documents** | `apps/documents/` | Confidential file vault, automatic file type and size metadata extraction, tenant/user isolation. |
| **Knowledge** | `apps/knowledge/` | Partitioned confidential knowledge collections ready for future RAG indexers. |
| **Agents** | `apps/agents/` | Task dispatcher, state machine (`PENDING` -> `RUNNING` -> `COMPLETED`/`FAILED`), execution linking. |
| **Models** | `apps/models/` | Model registry, capability matrices, and pluggable AI adapter interfaces (`base.py`, `mock.py`, `registry.py`). |
| **Tools** | `apps/tools/` | Industrial tool catalog with granular role requirements and toggle switches. |
| **Audit** | `apps/audit/` | Tamper-resistant compliance logging, request interception middleware, IP/user attribution. |
| **Security** | `apps/security/` | Sovereignty receipt engine, canonical JSON serializer, SHA-256 integrity seal generation and verification. |

---

## 4. Modular AI Adapter Design

The AI subsystem adheres strictly to Dependency Inversion:
```
           [ Agent Task Runner ]
                     |
                     v
          <<BaseAgentOrchestrator>>
          <<BaseLLMAdapter>>
          <<BaseVisionAdapter>>
          <<BaseEmbeddingAdapter>>
          <<BaseVectorDBAdapter>>
                     |
        +------------+------------+
        |                         |
 [ Mock Adapters ]        [ Real Local Engines ]
 (Zero-GPU testing,       (Ollama / vLLM /
  Deterministic)           llama.cpp / Qdrant)
```

- High-level business logic only interacts with abstract interfaces.
- The default installation includes full deterministic mock adapters enabling development, test runs, and continuous integration without GPU access.
- Switching to on-premise model instances requires changing configuration entries in `ModelRegistry` without altering API contracts or data pipelines.

---

## 5. Air-Gap & Sovereignty Guarantee

1. **Zero External Egress Guarantee**: All dependencies, model weights, and data repositories must reside within the on-premise private subnet.
2. **Cryptographic Proof (SovereigntyReceipt)**: Every completed agent task generates a canonical SHA-256 seal across:
   - Task ID
   - Models utilized
   - Vault files accessed
   - Tools invoked
   - External network requests (monitored and verified = 0)
   - Network confinement state (`AIR_GAPPED_LOCAL`)
3. **Receipt Verification**: An auditor can call `/api/receipts/<id>/verify/` to mathematically prove the execution record was not modified and that no external leaks occurred.
