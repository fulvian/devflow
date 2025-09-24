#!/usr/bin/env python3
"""
Protocol Health Validation Script
Validates consistency and compliance of DevFlow protocol ecosystem
"""

import json
import os
import sys
import sqlite3
import requests
from datetime import datetime
from pathlib import Path

# Configuration
PROTOCOL_REGISTRY = "/Users/fulvioventura/devflow/config/protocol-registry.json"
DATABASE_PATH = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
ORCHESTRATOR_HEALTH = "http://localhost:3005/health"

class ProtocolValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.passed = []

    def log_error(self, test: str, message: str):
        self.errors.append(f"❌ {test}: {message}")

    def log_warning(self, test: str, message: str):
        self.warnings.append(f"⚠️  {test}: {message}")

    def log_pass(self, test: str, message: str = ""):
        self.passed.append(f"✅ {test}" + (f": {message}" if message else ""))

    def validate_registry_existence(self):
        """Check if protocol registry exists and is valid JSON"""
        if not os.path.exists(PROTOCOL_REGISTRY):
            self.log_error("Registry Existence", f"Protocol registry not found at {PROTOCOL_REGISTRY}")
            return False

        try:
            with open(PROTOCOL_REGISTRY, 'r') as f:
                registry = json.load(f)
            self.log_pass("Registry Existence", "Protocol registry found and valid JSON")
            return registry
        except json.JSONDecodeError as e:
            self.log_error("Registry JSON", f"Invalid JSON in protocol registry: {e}")
            return False

    def validate_active_protocols(self, registry):
        """Validate all active protocols exist and are accessible"""
        base_path = "/Users/fulvioventura/devflow"

        for protocol_name, protocol_info in registry.get('active_protocols', {}).items():
            protocol_path = base_path + protocol_info['path']

            if os.path.exists(protocol_path):
                self.log_pass("Protocol File", f"{protocol_name} exists")
            else:
                self.log_error("Protocol File", f"{protocol_name} not found at {protocol_path}")

    def validate_deprecated_cleanup(self, registry):
        """Check if deprecated protocols are properly handled"""
        base_path = "/Users/fulvioventura/devflow"

        for protocol_name, protocol_info in registry.get('deprecated_protocols', {}).items():
            protocol_path = base_path + protocol_info['path']
            deprecated_path = protocol_path + ".DEPRECATED"
            old_path = protocol_path + ".OLD"

            if os.path.exists(deprecated_path) or os.path.exists(old_path):
                self.log_pass("Deprecated Handling", f"{protocol_name} properly deprecated")
            elif os.path.exists(protocol_path):
                self.log_warning("Deprecated Handling", f"{protocol_name} still exists - not properly deprecated")
            else:
                self.log_pass("Deprecated Removal", f"{protocol_name} removed as scheduled")

    def validate_hook_integration(self, registry):
        """Validate hook files exist and are executable"""
        base_path = "/Users/fulvioventura/devflow"

        for hook_name, hook_info in registry.get('hook_integrations', {}).items():
            hook_path = base_path + hook_info['path']

            if os.path.exists(hook_path):
                if os.access(hook_path, os.X_OK):
                    self.log_pass("Hook Executable", f"{hook_name} exists and executable")
                else:
                    self.log_warning("Hook Permissions", f"{hook_name} exists but not executable")
            else:
                self.log_error("Hook Missing", f"{hook_name} not found at {hook_path}")

    def validate_orchestrator_connectivity(self):
        """Check if Unified Orchestrator is responsive"""
        try:
            response = requests.get(ORCHESTRATOR_HEALTH, timeout=5)
            if response.status_code == 200:
                self.log_pass("Orchestrator Health", "Unified Orchestrator responsive")
            else:
                self.log_warning("Orchestrator Health", f"Orchestrator returned {response.status_code}")
        except requests.exceptions.ConnectionError:
            self.log_warning("Orchestrator Health", "Orchestrator not running (expected in development)")
        except Exception as e:
            self.log_error("Orchestrator Health", f"Error checking orchestrator: {e}")

    def validate_database_integrity(self):
        """Check database existence and key tables"""
        if not os.path.exists(DATABASE_PATH):
            self.log_error("Database", f"Unified database not found at {DATABASE_PATH}")
            return

        try:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()

            # Check key tables exist
            required_tables = ['projects', 'tasks', 'task_contexts', 'cometa_sessions']
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            existing_tables = [row[0] for row in cursor.fetchall()]

            missing_tables = [table for table in required_tables if table not in existing_tables]

            if missing_tables:
                self.log_error("Database Schema", f"Missing tables: {missing_tables}")
            else:
                self.log_pass("Database Schema", "All required tables present")

            # Check if current task exists
            cursor.execute("SELECT COUNT(*) FROM tasks WHERE name = 'rules-n-protocols-review'")
            task_count = cursor.fetchone()[0]

            if task_count > 0:
                self.log_pass("Task Management", "Current protocol review task found in database")
            else:
                self.log_warning("Task Management", "Protocol review task not found in database")

            conn.close()

        except sqlite3.Error as e:
            self.log_error("Database Connection", f"Error connecting to database: {e}")

    def validate_claude_md_consistency(self):
        """Check CLAUDE.md has latest requirements"""
        claude_md_path = "/Users/fulvioventura/devflow/CLAUDE.md"

        if not os.path.exists(claude_md_path):
            self.log_error("CLAUDE.md", "Main enforcement file not found")
            return

        with open(claude_md_path, 'r') as f:
            content = f.read()

        # Check for updated orchestrator requirements
        required_sections = [
            "UPDATED 2025-09-24 - CRITICAL PROTOCOL CONSOLIDATION",
            "BREAKING CHANGES",
            "POST http://localhost:3005/api/tasks",
            "unified-orchestrator-bridge.py"
        ]

        missing_sections = []
        for section in required_sections:
            if section not in content:
                missing_sections.append(section)

        if missing_sections:
            self.log_error("CLAUDE.md Content", f"Missing updated sections: {missing_sections}")
        else:
            self.log_pass("CLAUDE.md Content", "All required protocol updates present")

    def run_all_validations(self):
        """Run complete validation suite"""
        print("🔍 DevFlow Protocol Health Check")
        print("=" * 50)
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Load registry
        registry = self.validate_registry_existence()
        if not registry:
            self.print_results()
            return False

        # Run all validations
        self.validate_active_protocols(registry)
        self.validate_deprecated_cleanup(registry)
        self.validate_hook_integration(registry)
        self.validate_orchestrator_connectivity()
        self.validate_database_integrity()
        self.validate_claude_md_consistency()

        self.print_results()
        return len(self.errors) == 0

    def print_results(self):
        """Print validation results"""
        print("\n📊 Validation Results")
        print("-" * 30)

        # Print passed tests
        for result in self.passed:
            print(result)

        # Print warnings
        for warning in self.warnings:
            print(warning)

        # Print errors
        for error in self.errors:
            print(error)

        print("\n📈 Summary")
        print("-" * 20)
        print(f"✅ Passed: {len(self.passed)}")
        print(f"⚠️  Warnings: {len(self.warnings)}")
        print(f"❌ Errors: {len(self.errors)}")

        if len(self.errors) == 0:
            print("\n🎉 All critical validations passed!")
            return True
        else:
            print(f"\n🚨 {len(self.errors)} critical errors found - intervention required")
            return False

def main():
    validator = ProtocolValidator()
    success = validator.run_all_validations()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()