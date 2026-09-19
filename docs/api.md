# REST API Reference: Sovereign AI Workbench (SIH26117)

All endpoints return JSON responses with standard HTTP status codes. Unhandled errors return a standard JSON structure:
```json
{
  "success": false,
  "status_code": 400,
  "error": { "detail": "Error description" }
}
```

---

## 1. System & Health

### `GET /api/health/`
Checks backend and database health along with air-gap mode indicators.
- **Auth:** None (Public)
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "sovereign-ai-workbench-backend",
  "version": "1.0.0-sih26117",
  "timestamp": "2026-09-19T13:30:59.072297+00:00",
  "air_gap_mode": true,
  "allow_external_egress": false,
  "components": {
    "database": "connected",
    "ai_engine": "mock_adapters_active",
    "sovereignty_guard": "enforced"
  }
}
```

### `GET /api/health/stats/`
Returns aggregated workbench metrics for dashboard visualization.
- **Auth:** Bearer Token

---

## 2. Authentication & Users

### `POST /api/auth/register/`
Registers a new user account.
- **Body:**
```json
{
  "username": "engineer_sarah",
  "email": "sarah@sovereign.local",
  "password": "SecurePassword123!",
  "role": "Engineer"
}
```

### `POST /api/auth/token/`
Obtains JWT Access and Refresh tokens.
- **Body:**
```json
{
  "username": "engineer_sarah",
  "password": "SecurePassword123!"
}
```
- **Response `200 OK`:**
```json
{
  "access": "<JWT_ACCESS_TOKEN>",
  "refresh": "<JWT_REFRESH_TOKEN>"
}
```

### `POST /api/auth/token/refresh/`
Refreshes an expired access token using the refresh token.

### `GET /api/users/me/`
Returns profile and role information for the currently authenticated user.

---

## 3. Confidential Document Vault

### `GET /api/documents/`
Lists accessible documents (filtered by user role).

### `POST /api/documents/`
Uploads a document to the local encrypted vault.
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `name`: String
  - `file`: Binary file upload

---

## 4. Knowledge Base

### `GET /api/knowledge/`
Lists confidential knowledge collections.

### `POST /api/knowledge/`
Creates a new knowledge base collection.
- **Body:**
```json
{
  "name": "Gas Turbine Technical Manuals",
  "description": "Proprietary operating parameters and maintenance schematics"
}
```

---

## 5. Agent Tasks & Orchestration

### `GET /api/agents/`
Lists agent tasks.

### `POST /api/agents/`
Dispatches a new sovereign agent task.
- **Body:**
```json
{
  "task_type": "CONFIDENTIAL_CAD_AUDIT",
  "input": {
    "prompt": "Audit high-pressure casing structural logs",
    "tools": ["cad_validator"]
  }
}
```

### `POST /api/agents/{id}/run/`
Executes the agent task through the modular local orchestrator, marks status as `COMPLETED`, and generates an immutable `SovereigntyReceipt`.
- **Response `200 OK`:**
```json
{
  "task": {
    "id": "ae9fa729-0dda-4ae8-9c3a-e516d10b31ae",
    "task_id": "SOV-TASK-42861FBEA4",
    "status": "COMPLETED",
    "output": { ... }
  },
  "receipt": {
    "receipt_id": "6af7671a-3762-45c6-b70a-fdd8d03a80fc",
    "integrity_hash": "1774e613ddfbd5a48f316f177ccc0389272ce292d2883478efd60ef7f438f84a",
    "network_status": "AIR_GAPPED_LOCAL",
    "external_requests": 0
  }
}
```

---

## 6. Model Registry & Local AI Adapters

### `GET /api/models/`
Lists registered local open-weight models.

### `POST /api/models/{id}/ping/`
Performs an on-premise local inference self-check without internet connectivity.

---

## 7. Tool Registry

### `GET /api/tools/`
Lists available industrial tools with role permissions.

### `POST /api/tools/{id}/toggle/`
Toggles a tool's enabled/disabled status.

---

## 8. Audit Trail & Sovereignty Receipts

### `GET /api/audit/`
Inspects audit logs (Restricted to `Admin` role).

### `GET /api/receipts/`
Lists sovereign execution receipts.

### `GET /api/receipts/{id}/verify/`
Mathematically recomputes the SHA-256 seal and validates zero-egress compliance.
- **Response `200 OK`:**
```json
{
  "is_valid": true,
  "is_air_gapped": true,
  "recorded_hash": "1774e613ddfbd5a48f316f177ccc0389272ce292d2883478efd60ef7f438f84a",
  "computed_hash": "1774e613ddfbd5a48f316f177ccc0389272ce292d2883478efd60ef7f438f84a",
  "external_requests": 0,
  "compliance_status": "SOVEREIGN_COMPLIANT"
}
```
