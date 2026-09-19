# Security & Sovereignty Architecture

**Project:** Sovereign On-Premise Agentic AI Workbench (SIH26117)  

---

## 1. Threat Model & Air-Gap Objectives

Confidential industrial environments face specific threats:
1. **Intellectual Property Exfiltration**: Sensitive CAD models, proprietary schematics, and sensor telemetry being sent to external cloud AI APIs (OpenAI, Anthropic, Google Cloud).
2. **Unauthorized Privilege Escalation**: Operators or contractors triggering destructive tools or downloading unauthorized specifications.
3. **Audit Trail Tampering**: Erasing or manipulating operational history following an incident or compliance check.
4. **Supply Chain / Telemetry Leakage**: Hidden phone-home analytics or metrics from AI libraries.

---

## 2. Core Security Controls

### 2.1. Strict Air-Gap Isolation
- The system checks `AIR_GAP_MODE=True` and `ALLOW_EXTERNAL_EGRESS=False`.
- The Docker Compose configuration runs in an isolated private bridge network without an internet gateway.
- AI modules communicate strictly over `localhost` or private IPC sockets.

### 2.2. Role-Based Access Control (RBAC)
The platform enforces a 4-tier role hierarchy:

| Role | Permissions |
|---|---|
| **Admin** | Full system administration, user management, audit log access, model/tool configuration. |
| **Engineer** | Register models, configure tools, execute agent workflows, upload/analyze vault documents. |
| **Analyst** | Upload and query documents, view knowledge collections, execute non-destructive analysis tasks. |
| **Operator** | Read-only inspection of assigned workflows and verification receipts. |

Permissions are enforced at the view and object levels via Django REST Framework permission classes (`IsAdminUserRole`, `IsEngineerOrAdmin`, `IsAnalystOrAbove`, `IsSelfOrAdmin`).

### 2.3. Automated Compliance Audit Trail
The `AuditLoggingMiddleware` captures all state-changing API operations (POST, PUT, PATCH, DELETE) across all vault endpoints:
- User identity (via JWT header or session)
- Client IP address
- Action name and target resource
- Request method, path, and HTTP status code
- UTC timestamp

Audit records cannot be edited or deleted through the API (`ReadOnlyModelViewSet`).

---

## 3. Cryptographic Sovereignty Receipts

To prove mathematically that an agent workflow ran entirely on-premise without external leaks:

### 3.1. Canonical Hash Generation
For every executed `AgentTask`, a `SovereigntyReceipt` is generated. A deterministic SHA-256 digest is calculated over canonical JSON:

$$\text{Integrity Hash} = \text{SHA256}(\text{SortKeys}(\{ \text{task\_id}, \text{models\_used}, \text{files\_accessed}, \text{tools\_used}, \text{external\_requests}, \text{network\_status} \}))$$

### 3.2. Tamper Detection
If any party attempts to modify the receipt (e.g. changing `external_requests` from 1 to 0), calling `/api/receipts/<id>/verify/` recalculates the hash against stored attributes:
- If `computed_hash != recorded_hash`: **`VIOLATION_DETECTED`**
- If `external_requests > 0`: **`VIOLATION_DETECTED`**
- If valid and un-tampered: **`SOVEREIGN_COMPLIANT`**
