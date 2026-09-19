# Development Guide: Sovereign AI Workbench Backend

This guide outlines setup, local development workflows, running migrations, and running test suites.

---

## 1. Prerequisites

- Python 3.11+
- Git
- Docker and Docker Compose (optional for local SQLite testing, required for production PostgreSQL deployment)

---

## 2. Local Setup (Zero-GPU & SQLite Ready)

1. Clone or navigate to the repository:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment:
   ```bash
   cp .env.example .env
   ```
   *Note: In development, `USE_SQLITE=True` is enabled by default so no PostgreSQL installation is required to start developing immediately.*

5. Apply migrations:
   ```bash
   python manage.py migrate
   ```

6. Seed industrial workbench data (Users, Open-Weight Models, Tools, Blueprints):
   ```bash
   python manage.py seed_workbench
   ```
   *Pre-populates the 4 role-based accounts (`admin`, `engineer_vikram`, `analyst_priya`, `operator_arun`), industrial models, and tools.*

7. Launch the local development server:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```

8. Open the Sovereign Workbench UI in your browser:
   ```
   http://127.0.0.1:8000/
   ```

9. Verify health status via API:
   ```bash
   curl http://127.0.0.1:8000/api/health/
   ```

---

## 3. Running Automated Tests

Run the complete test suite across all sovereign apps:
```bash
python manage.py test
```

To run a specific test suite:
```bash
# Workbench & Health tests
python manage.py test apps.workbench.tests

# Security & Sovereignty Receipt verification tests
python manage.py test apps.security.tests

# Authentication & RBAC tests
python manage.py test apps.accounts.tests

# Document Vault tests
python manage.py test apps.documents.tests

# AI Adapter & Model Registry tests
python manage.py test apps.models.tests

# Audit Logging tests
python manage.py test apps.audit.tests
```

---

## 4. Connecting Real On-Premise Models

When deploying in a GPU-equipped industrial environment:

1. Launch your local model runner (e.g. Ollama or vLLM):
   ```bash
   ollama run llama3.3
   ```
2. Navigate to `/api/models/` and register the model with provider `OLLAMA` or `VLLM` and the local endpoint (e.g. `http://127.0.0.1:11434`).
3. The adapter factory in `apps/models/adapters/registry.py` will route tasks directly to the local socket without passing traffic outside the machine.
