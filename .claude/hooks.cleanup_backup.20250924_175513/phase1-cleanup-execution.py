#!/usr/bin/env python3
"""
Phase 1: Hook System Cleanup Execution
Implements comprehensive hook consolidation following Google Python Style Guide

This script performs the systematic cleanup identified in the audit:
- Removes deprecated hooks (3 hooks)
- Consolidates Cometa system (17 → 4 hooks)
- Optimizes core hooks (removes duplicates)
- Follows Context7 best practices for all operations

References:
- Google Python Style Guide: /websites/google_github_io_styleguide
- Context7 Hook Architecture Standards
- Comprehensive Hook Audit Analysis Results
"""

import os
import json
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import sqlite3

# Configure logging following Google Style Guide
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/fulvioventura/devflow/logs/hook-cleanup.log'),
        logging.StreamHandler()
    ]
)

class HookCleanupExecutor:
    """Executes Phase 1 hook system cleanup with comprehensive logging and validation"""

    def __init__(self):
        self.hooks_dir = Path("/Users/fulvioventura/devflow/.claude/hooks")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.backup_dir = None
        self.cleanup_results = {
            'start_time': datetime.now().isoformat(),
            'operations': [],
            'deleted_hooks': [],
            'preserved_hooks': [],
            'errors': [],
            'warnings': []
        }

        # Define hook categories for systematic cleanup
        self.cleanup_plan = {
            'deprecated_hooks': [
                '.deprecated/memory-stream-workaround.py',
                '.deprecated/test-posttooluse.py',
                '.deprecated/test-userprompt-hook.py'
            ],
            'cometa_hooks_to_remove': [
                'cometa_batch_manager.py',
                'cometa_nlp_processor.py',
                'cometa_progress_tracker.py',
                'cometa_task_executor.py',
                'cometa-context-search.py',
                'cometa-memory-stream.py',  # Duplicate of Context7 version
                'cometa-nlp-hook.py',
                'cometa-project-loader.py',
                'cometa-slash-command.py',
                'cometa-task-autocreator.py',
                'cometa-user-prompt-hook.py',
                'cometa-user-prompt-intelligence.py'
            ],
            'cometa_hooks_to_preserve': [
                'cometa-memory-stream-hook.py',  # Context7 compliant
                'cometa-system-status-hook.py',  # Context7 compliant
                'cometa-brain-sync.py',          # Context7 compliant
                'unified-cometa-processor.py'    # Context7 compliant
            ],
            'system_hooks_to_remove': [
                'footer-display.py',
                'footer-details.py',
                'session-monitor.py'
            ],
            'core_hooks_to_remove': [
                'user-messages.py'  # Replaced by Context7 version
            ],
            'core_hooks_to_preserve': [
                'session-start.py',
                'post-tool-use.py',
                'user-prompt-submit-context7.py'
            ]
        }

    def execute_phase1_cleanup(self) -> Dict[str, Any]:
        """Execute complete Phase 1 cleanup following systematic approach"""
        logging.info("🚀 Starting Phase 1 Hook System Cleanup")
        logging.info("=" * 60)

        try:
            # Step 1: Validate current state
            self._validate_current_state()

            # Step 2: Create additional backup
            self._create_cleanup_backup()

            # Step 3: Execute systematic cleanup
            self._remove_deprecated_hooks()
            self._consolidate_cometa_system()
            self._optimize_core_hooks()
            self._cleanup_system_hooks()

            # Step 4: Validate results
            self._validate_cleanup_results()

            # Step 5: Generate cleanup report
            self._generate_cleanup_report()

            self.cleanup_results['status'] = 'success'
            self.cleanup_results['end_time'] = datetime.now().isoformat()

            logging.info("✅ Phase 1 Cleanup completed successfully")
            return self.cleanup_results

        except Exception as e:
            error_msg = f"Phase 1 cleanup failed: {str(e)}"
            logging.error(error_msg)
            self.cleanup_results['errors'].append(error_msg)
            self.cleanup_results['status'] = 'failed'

            # Attempt rollback if possible
            self._attempt_rollback()
            raise

    def _validate_current_state(self) -> None:
        """Validate current hook system state before cleanup"""
        logging.info("🔍 Validating current hook system state...")

        if not self.hooks_dir.exists():
            raise ValueError(f"Hooks directory not found: {self.hooks_dir}")

        # Count current hooks
        current_hooks = list(self.hooks_dir.rglob("*.py"))
        logging.info(f"📊 Current hooks count: {len(current_hooks)}")

        # Validate Context7 hooks exist
        context7_hooks = [
            'cometa-memory-stream-hook.py',
            'cometa-system-status-hook.py',
            'cometa-brain-sync.py',
            'unified-cometa-processor.py',
            'user-prompt-submit-context7.py'
        ]

        for hook in context7_hooks:
            hook_path = self.hooks_dir / hook
            if not hook_path.exists():
                raise ValueError(f"Required Context7 hook not found: {hook}")

        logging.info("✅ Current state validation completed")

    def _create_cleanup_backup(self) -> None:
        """Create additional backup specific to cleanup operation"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_dir = self.hooks_dir.parent / f"hooks.cleanup_backup.{timestamp}"

        logging.info(f"💾 Creating cleanup backup: {self.backup_dir}")
        shutil.copytree(self.hooks_dir, self.backup_dir)

        self.cleanup_results['backup_location'] = str(self.backup_dir)
        logging.info("✅ Cleanup backup created successfully")

    def _remove_deprecated_hooks(self) -> None:
        """Remove deprecated hooks from .deprecated/ directory"""
        logging.info("🗑️ Removing deprecated hooks...")

        deprecated_dir = self.hooks_dir / '.deprecated'
        if deprecated_dir.exists():
            # Log contents before removal
            deprecated_files = list(deprecated_dir.rglob("*.py"))
            logging.info(f"📋 Found {len(deprecated_files)} deprecated files")

            for file_path in deprecated_files:
                relative_path = str(file_path.relative_to(self.hooks_dir))
                logging.info(f"   ❌ Removing: {relative_path}")
                self.cleanup_results['deleted_hooks'].append(relative_path)

            # Remove entire deprecated directory
            shutil.rmtree(deprecated_dir)
            self.cleanup_results['operations'].append({
                'operation': 'remove_deprecated_directory',
                'target': '.deprecated/',
                'files_removed': len(deprecated_files),
                'timestamp': datetime.now().isoformat()
            })

            logging.info(f"✅ Removed {len(deprecated_files)} deprecated hooks")
        else:
            logging.info("ℹ️ No .deprecated directory found")

    def _consolidate_cometa_system(self) -> None:
        """Consolidate Cometa hook system from 17 → 4 hooks"""
        logging.info("♻️ Consolidating Cometa hook system...")

        removed_count = 0
        preserved_count = 0

        # Remove redundant Cometa hooks
        for hook_name in self.cleanup_plan['cometa_hooks_to_remove']:
            hook_path = self.hooks_dir / hook_name
            if hook_path.exists():
                logging.info(f"   ❌ Removing redundant Cometa hook: {hook_name}")
                hook_path.unlink()
                self.cleanup_results['deleted_hooks'].append(hook_name)
                removed_count += 1
            else:
                logging.warning(f"   ⚠️ Hook not found: {hook_name}")
                self.cleanup_results['warnings'].append(f"Hook not found: {hook_name}")

        # Verify preserved Cometa hooks
        for hook_name in self.cleanup_plan['cometa_hooks_to_preserve']:
            hook_path = self.hooks_dir / hook_name
            if hook_path.exists():
                logging.info(f"   ✅ Preserving Context7 hook: {hook_name}")
                self.cleanup_results['preserved_hooks'].append(hook_name)
                preserved_count += 1
            else:
                error_msg = f"Critical Context7 hook missing: {hook_name}"
                logging.error(f"   ❌ {error_msg}")
                self.cleanup_results['errors'].append(error_msg)

        self.cleanup_results['operations'].append({
            'operation': 'consolidate_cometa_system',
            'removed': removed_count,
            'preserved': preserved_count,
            'target_architecture': '17_to_4_hooks',
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"✅ Cometa consolidation: -{removed_count} hooks, preserved {preserved_count}")

    def _optimize_core_hooks(self) -> None:
        """Optimize core hook system by removing duplicates"""
        logging.info("🔧 Optimizing core hook system...")

        removed_count = 0
        preserved_count = 0

        # Remove replaced core hooks
        for hook_name in self.cleanup_plan['core_hooks_to_remove']:
            hook_path = self.hooks_dir / hook_name
            if hook_path.exists():
                logging.info(f"   ❌ Removing replaced hook: {hook_name}")
                hook_path.unlink()
                self.cleanup_results['deleted_hooks'].append(hook_name)
                removed_count += 1

        # Verify preserved core hooks
        for hook_name in self.cleanup_plan['core_hooks_to_preserve']:
            hook_path = self.hooks_dir / hook_name
            if hook_path.exists():
                logging.info(f"   ✅ Preserving core hook: {hook_name}")
                self.cleanup_results['preserved_hooks'].append(hook_name)
                preserved_count += 1
            else:
                error_msg = f"Critical core hook missing: {hook_name}"
                logging.error(f"   ❌ {error_msg}")
                self.cleanup_results['errors'].append(error_msg)

        self.cleanup_results['operations'].append({
            'operation': 'optimize_core_hooks',
            'removed': removed_count,
            'preserved': preserved_count,
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"✅ Core optimization: -{removed_count} hooks, preserved {preserved_count}")

    def _cleanup_system_hooks(self) -> None:
        """Cleanup system hooks (footer, monitoring) - functionality moved to status hook"""
        logging.info("🧹 Cleaning up system hooks...")

        removed_count = 0

        for hook_name in self.cleanup_plan['system_hooks_to_remove']:
            hook_path = self.hooks_dir / hook_name
            if hook_path.exists():
                logging.info(f"   ❌ Removing system hook: {hook_name}")
                logging.info(f"       → Functionality moved to cometa-system-status-hook.py")
                hook_path.unlink()
                self.cleanup_results['deleted_hooks'].append(hook_name)
                removed_count += 1

        self.cleanup_results['operations'].append({
            'operation': 'cleanup_system_hooks',
            'removed': removed_count,
            'consolidated_into': 'cometa-system-status-hook.py',
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"✅ System cleanup: -{removed_count} hooks, consolidated functionality")

    def _validate_cleanup_results(self) -> None:
        """Validate cleanup results and ensure system integrity"""
        logging.info("🔍 Validating cleanup results...")

        # Count remaining hooks
        remaining_hooks = list(self.hooks_dir.rglob("*.py"))

        # Filter out the audit script itself
        remaining_hooks = [h for h in remaining_hooks if 'audit' not in h.name.lower()]

        logging.info(f"📊 Remaining hooks after cleanup: {len(remaining_hooks)}")

        # Validate critical Context7 hooks still exist
        critical_hooks = [
            'base/standard_hook_pattern.py',
            'cometa-memory-stream-hook.py',
            'cometa-system-status-hook.py',
            'cometa-brain-sync.py',
            'unified-cometa-processor.py',
            'user-prompt-submit-context7.py',
            'session-start.py',
            'post-tool-use.py'
        ]

        missing_critical = []
        for hook in critical_hooks:
            if not (self.hooks_dir / hook).exists():
                missing_critical.append(hook)

        if missing_critical:
            error_msg = f"Critical hooks missing after cleanup: {missing_critical}"
            logging.error(error_msg)
            self.cleanup_results['errors'].append(error_msg)
            raise ValueError(error_msg)

        # Test hook functionality
        self._test_critical_hooks()

        self.cleanup_results['final_hook_count'] = len(remaining_hooks)
        self.cleanup_results['critical_hooks_validated'] = len(critical_hooks)

        logging.info("✅ Cleanup validation completed successfully")

    def _test_critical_hooks(self) -> None:
        """Test critical hooks for basic functionality"""
        logging.info("🧪 Testing critical hooks...")

        import subprocess

        test_input = {
            'session_id': 'test-cleanup',
            'hook_event_name': 'PostToolUse',
            'cwd': '/Users/fulvioventura/devflow',
            'toolCallResult': {
                'toolName': 'Test',
                'toolInput': {'test': 'cleanup'},
                'toolResponse': {'status': 'success'}
            }
        }

        critical_hooks_to_test = [
            'user-prompt-submit-context7.py',
            'cometa-brain-sync.py'
        ]

        for hook in critical_hooks_to_test:
            hook_path = self.hooks_dir / hook
            if hook_path.exists():
                try:
                    result = subprocess.run(
                        ['python3', str(hook_path)],
                        input=json.dumps(test_input),
                        text=True,
                        capture_output=True,
                        timeout=10
                    )

                    if result.returncode == 0:
                        logging.info(f"   ✅ Hook test passed: {hook}")
                    else:
                        logging.warning(f"   ⚠️ Hook test failed: {hook} (rc: {result.returncode})")
                        self.cleanup_results['warnings'].append(f"Hook test failed: {hook}")

                except Exception as e:
                    logging.warning(f"   ⚠️ Hook test error: {hook} - {str(e)}")
                    self.cleanup_results['warnings'].append(f"Hook test error: {hook}")

        logging.info("✅ Hook testing completed")

    def _generate_cleanup_report(self) -> None:
        """Generate comprehensive cleanup report"""
        report_path = self.hooks_dir / "phase1-cleanup-report.json"

        # Calculate statistics
        total_deleted = len(self.cleanup_results['deleted_hooks'])
        total_preserved = len(self.cleanup_results['preserved_hooks'])

        self.cleanup_results['statistics'] = {
            'hooks_deleted': total_deleted,
            'hooks_preserved': total_preserved,
            'operations_completed': len(self.cleanup_results['operations']),
            'errors_encountered': len(self.cleanup_results['errors']),
            'warnings_generated': len(self.cleanup_results['warnings']),
            'final_hook_count': self.cleanup_results.get('final_hook_count', 0)
        }

        # Add recommendations for Phase 2
        self.cleanup_results['phase2_recommendations'] = [
            "Consolidate utility hooks (shared_state.py, etc.)",
            "Optimize integration hooks",
            "Create new consolidated performance monitor",
            "Implement hook lifecycle management system",
            "Add comprehensive system diagnostics"
        ]

        # Save report
        with open(report_path, 'w') as f:
            json.dump(self.cleanup_results, f, indent=2, default=str)

        logging.info(f"📊 Cleanup report saved: {report_path}")

        # Store in database if available
        self._store_cleanup_results_in_db()

    def _store_cleanup_results_in_db(self) -> None:
        """Store cleanup results in database for tracking"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS hook_cleanup_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cleanup_date TEXT,
                        phase TEXT,
                        hooks_deleted INTEGER,
                        hooks_preserved INTEGER,
                        final_count INTEGER,
                        status TEXT,
                        results_json TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                conn.execute("""
                    INSERT INTO hook_cleanup_history (
                        cleanup_date, phase, hooks_deleted, hooks_preserved,
                        final_count, status, results_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    self.cleanup_results['start_time'],
                    'phase1',
                    self.cleanup_results['statistics']['hooks_deleted'],
                    self.cleanup_results['statistics']['hooks_preserved'],
                    self.cleanup_results['statistics']['final_hook_count'],
                    self.cleanup_results['status'],
                    json.dumps(self.cleanup_results['statistics'])
                ))

                logging.info("💾 Cleanup results stored in database")

        except sqlite3.Error as e:
            logging.warning(f"Could not store cleanup results in database: {e}")

    def _attempt_rollback(self) -> None:
        """Attempt to rollback changes if cleanup fails"""
        if self.backup_dir and self.backup_dir.exists():
            logging.info("🔄 Attempting rollback of failed cleanup...")

            try:
                # Remove current hooks directory
                if self.hooks_dir.exists():
                    shutil.rmtree(self.hooks_dir)

                # Restore from backup
                shutil.copytree(self.backup_dir, self.hooks_dir)
                logging.info("✅ Rollback completed successfully")

            except Exception as e:
                logging.error(f"❌ Rollback failed: {str(e)}")
        else:
            logging.error("❌ No backup available for rollback")

if __name__ == "__main__":
    executor = HookCleanupExecutor()

    try:
        results = executor.execute_phase1_cleanup()

        # Print summary
        stats = results['statistics']
        print("\n" + "=" * 60)
        print("🎯 PHASE 1 CLEANUP SUMMARY")
        print("=" * 60)
        print(f"📊 Hooks Deleted: {stats['hooks_deleted']}")
        print(f"📊 Hooks Preserved: {stats['hooks_preserved']}")
        print(f"📊 Final Hook Count: {stats['final_hook_count']}")
        print(f"⚠️ Errors: {stats['errors_encountered']}")
        print(f"⚠️ Warnings: {stats['warnings_generated']}")
        print(f"✅ Status: {results['status'].upper()}")
        print("=" * 60)

        if stats['errors_encountered'] == 0:
            print("🎉 Phase 1 cleanup completed successfully!")
            print("📋 Ready for Phase 2 optimization")
        else:
            print("⚠️ Cleanup completed with errors - review logs")

    except Exception as e:
        logging.error(f"Script execution failed: {str(e)}")
        print(f"\n❌ CLEANUP FAILED: {str(e)}")
        print("📋 Check logs for details and backup location")