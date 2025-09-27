#!/usr/bin/env python3
"""
Cometa Brain Sync Hook - Context7 Implementation

DevFlow Cometa Brain synchronization hook for maintaining brain state consistency
across session boundaries. Handles session starts, tool executions, and brain updates.

Author: DevFlow System
Created: 2025-09-24
Context7 Version: 2.0
"""

import json
import sys
import os
import subprocess
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import BaseDevFlowHook

class CometaBrainSyncHook(BaseDevFlowHook):
    """Context7-compliant Cometa Brain synchronization hook"""

    def __init__(self):
        super().__init__("cometa-brain-sync")
        self.brain_authority_script = "/Users/fulvioventura/devflow/src/core/cometa/cometa-brain-authority.js"

    def validate_input(self) -> bool:
        """Validate Cometa Brain Sync input"""
        # This hook is tolerant of various inputs
        return True

    def execute_logic(self) -> None:
        """Main Cometa Brain synchronization logic"""
        try:
            # Determine hook event
            hook_event = self.input_data.get('hook_event_name', 'PostToolUse')

            # Execute brain sync
            sync_result = self._execute_brain_sync(hook_event)

            # Update response metadata
            self.response.metadata.update({
                'cometa_sync_success': sync_result['success'],
                'sync_duration': sync_result.get('duration', 0),
                'brain_entries_processed': sync_result.get('entries', 0),
                'hook_event': hook_event
            })

            # Always continue execution (fail-open design)
            self.response.continue_execution = True

            if sync_result['success']:
                self.logger.info("Cometa Brain sync completed successfully")
            else:
                self.logger.warning(f"Cometa Brain sync failed: {sync_result.get('error', 'Unknown error')}")

        except Exception as e:
            self.logger.error(f"Cometa Brain sync error: {str(e)}")
            self.response.continue_execution = True  # Fail-open design
            self.response.metadata['sync_error'] = str(e)

    def _execute_brain_sync(self, hook_event: str) -> Dict[str, Any]:
        """Execute the Cometa Brain synchronization script"""
        sync_result = {
            'success': False,
            'error': None,
            'duration': 0,
            'entries': 0
        }

        try:
            start_time = datetime.now()

            if not os.path.exists(self.brain_authority_script):
                sync_result['error'] = "Brain authority script not found"
                return sync_result

            # Setup environment
            env = os.environ.copy()
            env["DB_PATH"] = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
            env["HOOK_EVENT"] = hook_event
            env["SESSION_ID"] = self.input_data.get('session_id', 'unknown')

            # Execute brain sync
            result = subprocess.run(
                ["node", self.brain_authority_script],
                env=env,
                capture_output=True,
                text=True,
                timeout=15,  # Increased timeout
                cwd="/Users/fulvioventura/devflow"
            )

            duration = (datetime.now() - start_time).total_seconds()
            sync_result['duration'] = duration

            if result.returncode == 0:
                sync_result['success'] = True
                # Try to parse output for entry count
                try:
                    if result.stdout.strip():
                        output_data = json.loads(result.stdout.strip())
                        sync_result['entries'] = output_data.get('entries_processed', 0)
                except json.JSONDecodeError:
                    pass
            else:
                sync_result['error'] = result.stderr or "Brain sync failed"

        except subprocess.TimeoutExpired:
            sync_result['error'] = "Brain sync timed out"
        except Exception as e:
            sync_result['error'] = str(e)

        return sync_result

# Main execution
def main():
    """Main hook execution entry point"""
    hook = CometaBrainSyncHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())