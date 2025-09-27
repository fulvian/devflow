#!/usr/bin/env python3
"""
DevFlow Active Services Mapper - Context7 Compliant
Analizza granularmente tutti i servizi attivi e i loro file dependencies
per garantire che la pulizia della codebase non impatti sui servizi critici.
"""

import os
import json
import sqlite3
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional

class DevFlowServicesMapper:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"
        self.services_map = {}
        self.critical_files = set()
        self.active_ports = []

    def check_active_services(self) -> Dict[str, Dict]:
        """Verifica tutti i servizi attivi tramite port check e health endpoints"""
        services_config = {
            "orchestrator": {"port": 3005, "path": "/health"},
            "database_manager": {"port": 3002, "path": "/health"},
            "project_api": {"port": 3003, "path": "/health"},
            "model_registry": {"port": 3004, "path": "/health"},
            "context_bridge": {"port": 3007, "path": "/health"},
            "vector_memory": {"port": 3008, "path": "/health"},
            "enhanced_memory": {"port": 3009, "path": "/health"},
            "dream_team": {"port": 3200, "path": "/health"},
            "cli_integration": {"port": 3201, "path": "/health"},
            "dashboard": {"port": 3202, "path": "/health"},
            "ws_dashboard": {"port": 3203, "path": "/health"},
            "codex_server": {"port": 8013, "path": "/health"},
            "enforcement": {"port": 8787, "path": "/health"},
            "metrics": {"port": 9091, "path": "/health"}
        }

        active_services = {}

        for service_name, config in services_config.items():
            port = config["port"]
            health_path = config["path"]

            # Check if port is listening
            port_check = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True, text=True
            )

            if port_check.returncode == 0:
                pids = port_check.stdout.strip().split('\n') if port_check.stdout.strip() else []

                # Health check
                health_check = subprocess.run(
                    ["curl", "-sf", "--max-time", "2", f"http://localhost:{port}{health_path}"],
                    capture_output=True, text=True
                )

                active_services[service_name] = {
                    "port": port,
                    "status": "healthy" if health_check.returncode == 0 else "unhealthy",
                    "pids": pids,
                    "health_response": health_check.stdout if health_check.returncode == 0 else None
                }

                if pids:
                    self.active_ports.append(port)

        return active_services

    def map_service_dependencies(self) -> Dict[str, List[str]]:
        """Mappa tutte le dipendenze critiche dei servizi attivi"""
        dependencies = {
            "critical_scripts": [
                "./start-devflow.sh",
                "./devflow-stop.sh"
            ],
            "core_packages": [
                "./packages/orchestrator/unified/dist/server.js",
                "./packages/core/dist/services/vector-memory-service.cjs"
            ],
            "daemon_files": [
                "./src/core/database/database-daemon.ts",
                "./src/core/services/model-registry-daemon.ts",
                "./src/core/mcp/cli-integration-daemon.ts",
                "./src/core/orchestration/real-dream-team-daemon.ts",
                "./src/daemon/progress-tracking-daemon.ts",
                "./src/daemon/progress-tracking-daemon-standalone.ts",
                "./src/api/project-lifecycle-api.js",
                "./src/core/ui/monitoring-dashboard.ts",
                "./.claude/hooks/apscheduler-embedding-daemon.py"
            ],
            "service_implementations": [
                "./src/services/context-bridge/start-context-bridge.ts",
                "./src/monitoring/index.js",
                "./dist/enforcement-daemon.js"
            ],
            "config_files": [
                "./.env",
                "./CLAUDE.md",
                "./.claude/settings.json",
                "./.claude/state/current_task.json"
            ],
            "database_files": [
                "./data/devflow_unified.sqlite",
                "./data/devflow_unified.sqlite-shm",
                "./data/devflow_unified.sqlite-wal"
            ],
            "logs_directory": [
                "./logs/"
            ]
        }

        # Verifica esistenza file critici
        existing_deps = {}
        for category, files in dependencies.items():
            existing_files = []
            for file_path in files:
                full_path = self.project_root / file_path.lstrip('./')
                if full_path.exists():
                    existing_files.append(str(full_path.relative_to(self.project_root)))
                    self.critical_files.add(str(full_path.relative_to(self.project_root)))
            existing_deps[category] = existing_files

        return existing_deps

    def identify_cleanup_candidates(self) -> Dict[str, List[str]]:
        """Identifica file candidati per cleanup con analisi granulare"""
        candidates = {
            "temporary_files": [],
            "generated_files": [],
            "test_files": [],
            "backup_files": [],
            "obsolete_scripts": []
        }

        # Pattern per identificazione automatica
        patterns = {
            "temporary_files": ["tmp", "temp", ".tmp"],
            "generated_files": ["generated-file-", "auto-generated", ".gen."],
            "test_files": ["test-", "spec-", ".test.", ".spec."],
            "backup_files": [".bak", ".backup", ".old", "~"],
            "obsolete_scripts": ["setup-", "install-", "init-"]
        }

        # Scan progetto per file candidati
        for root, dirs, files in os.walk(self.project_root):
            # Skip directories critiche
            rel_root = Path(root).relative_to(self.project_root)
            if any(skip in str(rel_root) for skip in ['.git', 'node_modules', 'logs']):
                continue

            for file in files:
                file_path = Path(root) / file
                rel_path = file_path.relative_to(self.project_root)

                # Skip file critici
                if str(rel_path) in self.critical_files:
                    continue

                # Categorizza in base ai pattern
                for category, category_patterns in patterns.items():
                    if any(pattern in file.lower() for pattern in category_patterns):
                        candidates[category].append(str(rel_path))
                        break

        return candidates

    def generate_safe_cleanup_plan(self, candidates: Dict[str, List[str]]) -> Dict:
        """Genera piano di cleanup sicuro con rollback"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        cleanup_plan = {
            "timestamp": timestamp,
            "total_candidates": sum(len(files) for files in candidates.values()),
            "active_services_count": len(self.services_map),
            "critical_files_protected": len(self.critical_files),
            "phases": {
                "phase_1_rename": {
                    "description": "Rinomina file con estensione .CANDIDATE.cleanup",
                    "files": []
                },
                "phase_2_validate": {
                    "description": "Verifica che tutti i servizi restino attivi per 24h",
                    "validation_commands": [
                        "./start-devflow.sh status",
                        "curl -sf http://localhost:3005/health"
                    ]
                },
                "phase_3_decision": {
                    "description": "Rimozione definitiva o rollback basato su validazione",
                    "rollback_script": f"./tools/rollback-cleanup-{timestamp}.sh"
                }
            }
        }

        # Assegna file a fase 1 (rinomina)
        for category, files in candidates.items():
            for file_path in files:
                if len(cleanup_plan["phases"]["phase_1_rename"]["files"]) < 10:  # Limite sicurezza
                    cleanup_plan["phases"]["phase_1_rename"]["files"].append({
                        "original": file_path,
                        "renamed": f"{file_path}.CANDIDATE.cleanup.{timestamp}",
                        "category": category
                    })

        return cleanup_plan

    def save_analysis_report(self, services: Dict, dependencies: Dict, candidates: Dict, plan: Dict):
        """Salva report completo dell'analisi"""
        report = {
            "analysis_timestamp": datetime.now().isoformat(),
            "active_services": services,
            "service_dependencies": dependencies,
            "cleanup_candidates": candidates,
            "cleanup_plan": plan,
            "safety_metrics": {
                "critical_files_protected": len(self.critical_files),
                "active_services_verified": len(services),
                "cleanup_candidates_total": sum(len(files) for files in candidates.values())
            }
        }

        report_path = self.project_root / "tools" / f"devflow-cleanup-analysis-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path.parent.mkdir(exist_ok=True)

        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        return report_path

    def run_complete_analysis(self):
        """Esegue analisi completa e genera report"""
        print("🔍 DevFlow Services Mapper - Analisi Granulare Iniziata")
        print("=" * 60)

        # 1. Check servizi attivi
        print("📊 Verifica servizi attivi...")
        self.services_map = self.check_active_services()
        print(f"✅ Trovati {len(self.services_map)} servizi attivi")

        # 2. Mappa dipendenze
        print("🗂️  Mappatura dipendenze critiche...")
        dependencies = self.map_service_dependencies()
        print(f"🛡️  Protetti {len(self.critical_files)} file critici")

        # 3. Identifica candidati cleanup
        print("🔍 Identificazione candidati cleanup...")
        candidates = self.identify_cleanup_candidates()
        total_candidates = sum(len(files) for files in candidates.values())
        print(f"📋 Trovati {total_candidates} candidati per cleanup")

        # 4. Genera piano sicuro
        print("📝 Generazione piano di cleanup sicuro...")
        plan = self.generate_safe_cleanup_plan(candidates)

        # 5. Salva report
        report_path = self.save_analysis_report(self.services_map, dependencies, candidates, plan)
        print(f"💾 Report salvato: {report_path}")

        # 6. Summary
        print("\n🎯 SUMMARY ANALISI:")
        print(f"   • Servizi Attivi: {len(self.services_map)}/14")
        print(f"   • File Critici Protetti: {len(self.critical_files)}")
        print(f"   • Candidati Cleanup: {total_candidates}")
        print(f"   • Piano Fasi: 3 (Rename → Validate → Execute)")

        return {
            "services": self.services_map,
            "dependencies": dependencies,
            "candidates": candidates,
            "plan": plan,
            "report_path": str(report_path)
        }

if __name__ == "__main__":
    mapper = DevFlowServicesMapper()
    result = mapper.run_complete_analysis()