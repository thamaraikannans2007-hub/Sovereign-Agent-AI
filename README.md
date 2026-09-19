# Sovereign On-Premise Agentic AI Workbench (SIH26117)

> **Sovereign On-Premise Agentic AI Workbench using Open-Weight Multimodal LLMs for Confidential Industry**  
> Problem Statement: **SIH26117**

---

## 1. Project Purpose

Confidential industrial sectors (defense, nuclear energy, heavy manufacturing, and critical infrastructure) require AI-assisted agentic reasoning and multimodal analysis on sensitive blueprints, sensor telemetry, and operational data. Sending this data to commercial cloud AI APIs (e.g. OpenAI, Anthropic) poses grave national security and intellectual property risks.

This project delivers the backend foundation for a **100% sovereign, on-premise, air-gapped agentic workbench**. It features:
- **Pluggable AI Adapters**: Interfaces for local LLMs, Vision LLMs, Embeddings, and Vector stores with mock adapters that run anywhere without a GPU.
- **Cryptographic Sovereignty Receipts**: Immutable SHA-256 sealed proofs that tasks were executed with **zero external network egress**.
- **Industrial RBAC**: 4-tier role hierarchy (`Admin`, `Engineer`, `Analyst`, `Operator`).
- **Comprehensive Audit Trail**: Automated audit logging of all mutating operations.
- **Containerized Air-Gap Architecture**: Docker & Compose configuration ready for isolated deployment.

---

## 2. System Architecture

```
backend/
├── manage.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .env
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── wsgi.py
│   ├── asgi.py
│   └── exceptions.py
├── apps/
│   ├── accounts/       # User model, 4 Roles, JWT Authentication & RBAC
│   ├── workbench/      # Health check, air-gap status, metrics overview
│   ├── documents/      # Confidential document vault
│   ├── knowledge/      # Knowledge base catalog
│   ├── agents/         # Agent task dispatch & execution state machine
│   ├── models/         # Model registry & modular AI adapters (Mock/Ollama/vLLM)
│   ├── tools/          # Industrial tools registry & permissions
│   ├── audit/          # Compliance audit trail & request middleware
│   └── security/       # Sovereignty receipts & SHA-256 verification
docs/
├── architecture.md     # Deep-dive architecture & module interactions
├── api.md              # REST API endpoint reference
├── development.md      # Local setup & testing instructions
└── security.md         # Threat model, air-gap guarantees, and receipts
```

---

## 3. Environment Variables

The backend is configured through environment variables (defined in `.env`):

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | *(Set in .env)* | Django cryptographic signing key |
| `DJANGO_DEBUG` | `True` | Debug mode (`False` in production) |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,0.0.0.0` | Permitted Host headers |
| `USE_SQLITE` | `True` | Use SQLite for zero-config local dev/testing |
| `POSTGRES_DB` | `sovereign_db` | PostgreSQL database name (Docker/Prod) |
| `POSTGRES_USER` | `sovereign_admin` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `sovereign_secure_pass` | PostgreSQL password |
| `POSTGRES_HOST` | `127.0.0.1` | Database host (`db` in Docker) |
| `POSTGRES_PORT` | `5432` | Database port |
| `AIR_GAP_MODE` | `True` | Enforce air-gapped operation flags |
| `ALLOW_EXTERNAL_EGRESS` | `False` | Disallow outbound internet requests |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Allowed frontend origins |

---

## 4. Running Locally

### Step 1: Clone & Setup Virtual Environment
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Run Migrations
```bash
python manage.py migrate
```

### Step 4: Run Automated Test Suites
```bash
python manage.py test
```

### Step 5: Start Development Server
```bash
python manage.py runserver 127.0.0.1:8000
```

### Step 6: Verify Health Status
```bash
curl http://127.0.0.1:8000/api/health/
```
Expected output:
```json
{
  "status": "healthy",
  "service": "sovereign-ai-workbench-backend",
  "version": "1.0.0-sih26117",
  "air_gap_mode": true,
  "allow_external_egress": false,
  "components": {
    "database": "connected",
    "ai_engine": "mock_adapters_active",
    "sovereignty_guard": "enforced"
  }
}
```

---

## 5. Running with Docker & PostgreSQL

The project includes an air-gap-ready Docker Compose configuration with persistent PostgreSQL and backend services.

```bash
cd backend
docker-compose up --build -d
```

Check status and logs:
```bash
docker-compose ps
docker-compose logs -f backend
```

---

## 6. Core REST API Endpoints

- **Health & Status:** `GET /api/health/`, `GET /api/health/stats/`
- **Authentication:** `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `POST /api/auth/register/`
- **Users:** `GET /api/users/`, `GET /api/users/me/`
- **Document Vault:** `GET /api/documents/`, `POST /api/documents/`
- **Knowledge Base:** `GET /api/knowledge/`, `POST /api/knowledge/`
- **Agent Tasks:** `GET /api/agents/`, `POST /api/agents/`, `POST /api/agents/{id}/run/`
- **Model Registry:** `GET /api/models/`, `POST /api/models/{id}/ping/`
- **Tools:** `GET /api/tools/`, `POST /api/tools/{id}/toggle/`
- **Audit Logs:** `GET /api/audit/`
- **Sovereignty Receipts:** `GET /api/receipts/`, `GET /api/receipts/{id}/verify/`

Refer to [docs/api.md](file:///c:/Users/KANNAN/Desktop/Prototying/docs/api.md) for full request/response schemas.
