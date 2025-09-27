#!/usr/bin/env python3
"""
DevFlow Safe Cleanup Executor - Context7 Ultra-Safe Implementation
Implementa pulizia sicura con rollback automatico e verifica continua dei servizi.
"""

import os
import json
import shutil
import subprocess
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

class DevFlowSafeCleanupExecutor:
    def __init__(self, analysis_report_path: str):
        self.project_root = Path(".").resolve()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Carica report di analisi
        with open(analysis_report_path) as f:
            self.analysis_report = json.load(f)

        self.backup_dir = self.project_root / "backups" / f"cleanup_{self.timestamp}"
        self.rollback_script_path = self.project_root / "tools" / f"rollback-cleanup-{self.timestamp}.sh"
        self.renamed_files = []

    def create_backup_infrastructure(self):
        """Crea infrastruttura di backup completa"""
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        # Crea manifesto backup
        backup_manifest = {
            "timestamp": self.timestamp,
            "original_analysis": self.analysis_report,
            "backup_directory": str(self.backup_dir),
            "rollback_script": str(self.rollback_script_path),
            "files_to_process": [],
            "safety_checks": {
                "pre_cleanup_services": len(self.analysis_report["active_services"]),
                "critical_files_protected": self.analysis_report["safety_metrics"]["critical_files_protected"]
            }
        }

        manifest_path = self.backup_dir / "backup_manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(backup_manifest, f, indent=2)

        print(f"📦 Backup infrastructure created: {self.backup_dir}")
        return manifest_path

    def generate_rollback_script(self):
        """Genera script di rollback automatico"""
        rollback_content = f"""#!/bin/bash
# DevFlow Safe Cleanup Rollback Script
# Generated: {datetime.now().isoformat()}
# Backup Directory: {self.backup_dir}

set -e

echo "🔄 DevFlow Cleanup Rollback Started..."
echo "⏰ Timestamp: {self.timestamp}"

# Function to restore a file
restore_file() {{
    local renamed_file="$1"
    local original_file="$2"

    if [ -f "$renamed_file" ]; then
        echo "↩️  Restoring: $original_file"
        mv "$renamed_file" "$original_file"
    else
        echo "⚠️  Warning: $renamed_file not found for rollback"
    fi
}}

# Restore all renamed files
echo "📁 Restoring renamed files..."
"""

        # Aggiungeremo le istruzioni di restore durante l'esecuzione
        rollback_content += """
echo "✅ Rollback completed"
echo "🔍 Verifying services..."
./start-devflow.sh status
echo "🎯 Rollback verification complete"
"""

        with open(self.rollback_script_path, 'w') as f:
            f.write(rollback_content)

        os.chmod(self.rollback_script_path, 0o755)
        print(f"📜 Rollback script created: {self.rollback_script_path}")

    def verify_services_health(self) -> bool:
        """Verifica che tutti i servizi siano ancora healthy"""
        print("🏥 Verifying services health...")

        healthy_count = 0
        total_services = len(self.analysis_report["active_services"])

        # Servizi WebSocket che richiedono controllo diverso
        websocket_services = {"ws_dashboard": 3203}

        for service_name, service_info in self.analysis_report["active_services"].items():
            port = service_info["port"]

            # Controllo specifico per WebSocket
            if service_name in websocket_services:
                # Per WebSocket, verifica solo che il processo risponda sulla porta
                ws_check = subprocess.run(
                    ["curl", "-s", "--max-time", "2", f"http://localhost:{port}"],
                    capture_output=True, text=True
                )
                # WebSocket risponde con "Upgrade Required" - questo è normale
                if "Upgrade Required" in ws_check.stdout or ws_check.returncode == 0:
                    healthy_count += 1
                    print(f"   ✅ {service_name} (:{port}) - WebSocket Active")
                else:
                    print(f"   ❌ {service_name} (:{port}) - WebSocket UNHEALTHY!")
                    return False
            else:
                # Controllo HTTP standard per altri servizi
                health_check = subprocess.run(
                    ["curl", "-sf", "--max-time", "3", f"http://localhost:{port}/health"],
                    capture_output=True, text=True
                )

                if health_check.returncode == 0:
                    healthy_count += 1
                    print(f"   ✅ {service_name} (:{port}) - Healthy")
                else:
                    print(f"   ❌ {service_name} (:{port}) - UNHEALTHY!")
                    return False

        print(f"🎯 Services health: {healthy_count}/{total_services} healthy")
        return healthy_count == total_services

    def execute_safe_rename_phase(self, max_files: int = 5) -> bool:
        """Esegue fase di rinomina sicura con limite ultra-conservativo"""
        print(f"🔄 Starting SAFE RENAME phase (max {max_files} files)...")

        # Verifica servizi prima dell'operazione
        if not self.verify_services_health():
            print("❌ Pre-cleanup health check failed - aborting")
            return False

        # Prendi solo i primi N file per sicurezza estrema
        candidates = self.analysis_report["cleanup_plan"]["phases"]["phase_1_rename"]["files"]
        files_to_process = candidates[:max_files]

        rollback_commands = []

        for file_info in files_to_process:
            original_path = Path(file_info["original"])
            renamed_path = Path(f"{file_info['original']}.CANDIDATE.cleanup.{self.timestamp}")

            if not original_path.exists():
                print(f"⚠️  Skipping {original_path} - file does not exist")
                continue

            # Backup del file prima della rinomina
            backup_file_path = self.backup_dir / original_path.name
            shutil.copy2(original_path, backup_file_path)

            # Rinomina sicura
            try:
                original_path.rename(renamed_path)
                self.renamed_files.append({
                    "original": str(original_path),
                    "renamed": str(renamed_path),
                    "backup": str(backup_file_path),
                    "category": file_info["category"]
                })
                rollback_commands.append(f"restore_file '{renamed_path}' '{original_path}'")
                print(f"   📝 Renamed: {original_path.name} → {renamed_path.name}")

                # Verifica servizi dopo ogni rinomina
                time.sleep(2)  # Pausa sicurezza
                if not self.verify_services_health():
                    print("❌ Service health check failed after rename - rolling back immediately")
                    self.execute_immediate_rollback()
                    return False

            except Exception as e:
                print(f"❌ Error renaming {original_path}: {e}")
                return False

        # Aggiorna script di rollback
        self.update_rollback_script(rollback_commands)

        print(f"✅ Safe rename completed: {len(self.renamed_files)} files processed")
        return True

    def update_rollback_script(self, rollback_commands: List[str]):
        """Aggiorna script di rollback con comandi specifici"""
        with open(self.rollback_script_path, 'r') as f:
            content = f.read()

        # Inserisci comandi di rollback
        commands_section = "\\n".join(rollback_commands)
        updated_content = content.replace(
            "# Restore all renamed files",
            f"# Restore all renamed files\\n{commands_section}"
        )

        with open(self.rollback_script_path, 'w') as f:
            f.write(updated_content)

    def execute_immediate_rollback(self):
        """Esegue rollback immediato in caso di problemi"""
        print("🚨 IMMEDIATE ROLLBACK TRIGGERED")

        for file_info in reversed(self.renamed_files):  # Rollback in ordine inverso
            renamed_path = Path(file_info["renamed"])
            original_path = Path(file_info["original"])

            if renamed_path.exists():
                renamed_path.rename(original_path)
                print(f"   ↩️  Restored: {original_path}")

        print("✅ Immediate rollback completed")

    def execute_24h_validation_mode(self):
        """Imposta modalità di validazione 24h"""
        validation_file = self.project_root / ".devflow" / f"cleanup_validation_{self.timestamp}.json"
        validation_data = {
            "start_time": datetime.now().isoformat(),
            "end_time": (datetime.now().timestamp() + 86400),  # +24 ore
            "renamed_files": self.renamed_files,
            "rollback_script": str(self.rollback_script_path),
            "status": "validation_active"
        }

        validation_file.parent.mkdir(exist_ok=True)
        with open(validation_file, 'w') as f:
            json.dump(validation_data, f, indent=2)

        print(f"⏰ 24h validation mode activated")
        print(f"📋 Validation file: {validation_file}")
        print(f"🔄 Rollback script: {self.rollback_script_path}")

    def run_safe_cleanup(self, max_files: int = 5):
        """Esegue cleanup completo ultra-sicuro"""
        print("🛡️  DevFlow Safe Cleanup Executor - ULTRA-SAFE MODE")
        print("=" * 60)

        # 1. Crea infrastruttura backup
        manifest_path = self.create_backup_infrastructure()

        # 2. Genera script rollback
        self.generate_rollback_script()

        # 3. Verifica iniziale servizi
        if not self.verify_services_health():
            print("❌ Initial health check failed - cleanup aborted")
            return False

        # 4. Esegue rinomina sicura
        if not self.execute_safe_rename_phase(max_files):
            print("❌ Safe rename phase failed")
            return False

        # 5. Attiva modalità validazione 24h
        self.execute_24h_validation_mode()

        print("\\n🎯 CLEANUP PHASE 1 COMPLETED SUCCESSFULLY")
        print(f"   • Files processed: {len(self.renamed_files)}")
        print(f"   • Services verified: ✅ All healthy")
        print(f"   • Rollback available: {self.rollback_script_path}")
        print(f"   • 24h validation: Active")
        print("\\n⏰ Next steps:")
        print("   1. Monitor system for 24 hours")
        print("   2. Verify all services remain healthy")
        print("   3. Run rollback if any issues detected")
        print(f"   4. Manual rollback: {self.rollback_script_path}")

        return True

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 devflow-safe-cleanup-executor.py <analysis_report.json>")
        sys.exit(1)

    executor = DevFlowSafeCleanupExecutor(sys.argv[1])
    success = executor.run_safe_cleanup(max_files=3)  # Ultra-conservativo: solo 3 file

    if not success:
        print("❌ Cleanup failed - check logs and rollback if needed")
        sys.exit(1)
    else:
        print("✅ Cleanup phase 1 completed successfully")