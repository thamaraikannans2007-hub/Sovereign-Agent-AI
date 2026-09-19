import os
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.accounts.models import User, Role
from apps.models.models import ModelRegistry, ModelProvider, ModelType, ModelStatus
from apps.tools.models import Tool
from apps.knowledge.models import KnowledgeBase
from apps.documents.models import Document, DocumentStatus


class Command(BaseCommand):
    help = "Seeds the sovereign on-premise workbench with industrial users, models, tools, and confidential blueprints."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting Sovereign Workbench Database Seeding..."))

        # 1. Users & Roles
        users_data = [
            ("admin", "admin@sovereign.local", "SovereignAdmin2026!", Role.ADMIN, "Lead Sovereign Architect"),
            ("engineer_vikram", "vikram@sovereign.local", "EngineerVikram2026!", Role.ENGINEER, "Senior Aerospace Structural Engineer"),
            ("analyst_priya", "priya@sovereign.local", "AnalystPriya2026!", Role.ANALYST, "Industrial Data & Telemetry Analyst"),
            ("operator_arun", "arun@sovereign.local", "OperatorArun2026!", Role.OPERATOR, "Field Facility Operations Supervisor"),
        ]

        created_users = {}
        for username, email, password, role, title in users_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "role": role},
            )
            user.role = role
            user.email = email
            user.set_password(password)
            if role == Role.ADMIN:
                user.is_staff = True
                user.is_superuser = True
            user.save()
            created_users[username] = user
            status = "Created" if created else "Updated"
            self.stdout.write(f"  [{status}] User: {username} ({role})")

        admin_user = created_users["admin"]
        engineer_user = created_users["engineer_vikram"]

        # 2. AI Model Registry
        models_data = [
            {
                "name": "deepseek-r1-distill-70b",
                "provider": ModelProvider.LOCAL_OLLAMA,
                "model_type": ModelType.LLM,
                "endpoint": "http://127.0.0.1:11434",
                "status": ModelStatus.ONLINE,
                "capabilities": {
                    "context_window": 65536,
                    "quantization": "Q4_K_M",
                    "specialty": "Deep Reasoning & Blueprint Logic Audit",
                    "air_gap_compliant": True,
                },
            },
            {
                "name": "llama-3.3-70b-industrial",
                "provider": ModelProvider.LOCAL_VLLM,
                "model_type": ModelType.LLM,
                "endpoint": "http://127.0.0.1:8000/v1",
                "status": ModelStatus.ONLINE,
                "capabilities": {
                    "context_window": 131072,
                    "tensor_parallel": 2,
                    "specialty": "Complex Industrial Operations Reasoning",
                    "air_gap_compliant": True,
                },
            },
            {
                "name": "qwen-2.5-vl-industrial",
                "provider": ModelProvider.MOCK,
                "model_type": ModelType.VISION,
                "endpoint": "http://127.0.0.1:11434",
                "status": ModelStatus.ONLINE,
                "capabilities": {
                    "resolution": "1344x1344",
                    "specialty": "CAD Blueprint & Weld Seam Visual Inspection",
                    "air_gap_compliant": True,
                },
            },
            {
                "name": "bge-large-en-v1.5",
                "provider": ModelProvider.MOCK,
                "model_type": ModelType.EMBEDDING,
                "endpoint": "local_memory",
                "status": ModelStatus.ONLINE,
                "capabilities": {
                    "dimensions": 1024,
                    "specialty": "Confidential Blueprint & SOP Vector Retrieval",
                    "air_gap_compliant": True,
                },
            },
        ]

        for m_info in models_data:
            m, created = ModelRegistry.objects.update_or_create(
                name=m_info["name"],
                defaults=m_info,
            )
            status = "Created" if created else "Updated"
            self.stdout.write(f"  [{status}] Model: {m.name} [{m.provider}]")

        # 3. Industrial Tools Registry
        tools_data = [
            (
                "cad_stress_analyzer",
                "Finite element stress, displacement, and load factor analyzer for STEP/DXF blueprints.",
                Role.ENGINEER,
                True,
            ),
            (
                "weld_seam_flaw_detector",
                "Computer vision flaw detector identifying porosity, micro-cracks, and lack of fusion in high-pressure welds.",
                Role.ENGINEER,
                True,
            ),
            (
                "scada_telemetry_analyzer",
                "Real-time sensor telemetry anomaly detector tracking thermodynamic pressure and turbine vibration.",
                Role.ANALYST,
                True,
            ),
            (
                "p_and_id_blueprint_parser",
                "Piping and Instrumentation Diagram extractor mapping valves, pumps, and emergency trip bypass loops.",
                Role.ANALYST,
                True,
            ),
            (
                "sovereignty_receipt_auditor",
                "Cryptographic SHA-256 seal verification utility checking for zero external network egress.",
                Role.OPERATOR,
                True,
            ),
        ]

        for name, desc, req_role, enabled in tools_data:
            t, created = Tool.objects.update_or_create(
                name=name,
                defaults={
                    "description": desc,
                    "permission_required": req_role,
                    "enabled": enabled,
                },
            )
            status = "Created" if created else "Updated"
            self.stdout.write(f"  [{status}] Tool: {t.name} (Requires {req_role})")

        # 4. Confidential Knowledge Collections
        kb_data = [
            (
                "Nuclear Facility Secondary Coolant Protocols",
                "Emergency depressurization, thermal transfer limits, and redundant pump actuation sequences for reactor secondary loops.",
            ),
            (
                "Heavy Gas Turbine Metallurgy Standards",
                "Single-crystal nickel superalloy fatigue curves, thermal barrier coating tolerances, and turbine shroud inspection criteria.",
            ),
        ]

        for name, desc in kb_data:
            kb, created = KnowledgeBase.objects.update_or_create(
                name=name,
                defaults={
                    "description": desc,
                    "created_by": engineer_user,
                },
            )
            status = "Created" if created else "Updated"
            self.stdout.write(f"  [{status}] Knowledge Base: {kb.name}")

        # 5. Sample Confidential Documents in Vault
        docs_data = [
            (
                "turbine_rotor_casing_rev4.dxf",
                b"0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nCASING_OUTLINE\n10\n0.0\n20\n0.0\n11\n450.0\n21\n120.0\n0\nENDSEC\n0\nEOF\n",
                "Turbine High-Pressure Rotor Casing Blueprint",
            ),
            (
                "coolant_loop_sensor_telemetry.csv",
                b"timestamp,sensor_id,loop_zone,temperature_c,pressure_bar,vibration_mms\n2026-09-19T08:00:00Z,TC-201,ZONE_B,312.4,142.1,0.42\n2026-09-19T08:05:00Z,TC-201,ZONE_B,314.1,143.5,0.45\n2026-09-19T08:10:00Z,TC-201,ZONE_B,318.9,144.2,0.48\n",
                "Reactor Secondary Coolant Telemetry Log",
            ),
        ]

        for filename, content, doc_name in docs_data:
            doc = Document.objects.filter(name=doc_name).first()
            if not doc:
                doc = Document(
                    name=doc_name,
                    uploaded_by=engineer_user,
                    status=DocumentStatus.READY,
                )
                doc.file.save(filename, ContentFile(content), save=True)
                self.stdout.write(f"  [Created] Document Vault File: {doc.name}")
            else:
                self.stdout.write(f"  [Existing] Document Vault File: {doc.name}")

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Sovereign Workbench database successfully seeded with industrial assets!"))
