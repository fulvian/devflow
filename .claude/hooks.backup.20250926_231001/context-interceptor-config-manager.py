#!/usr/bin/env python3

"""
Context Interceptor Configuration Manager
Context7-Compliant Configuration and Mode Management

Handles configuration loading, validation, mode switching,
and safety compliance for the Context Interceptor system
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
import subprocess

class ContextInterceptorConfigManager:
    """
    Context7-compliant configuration manager for Context Interceptor
    Handles mode switching, validation, and safety compliance
    """

    def __init__(self, project_root: Optional[str] = None):
        self.project_root = project_root or os.getcwd()
        self.config_path = os.path.join(
            self.project_root,
            '.claude/config/context-interceptor-config.json'
        )
        self.config: Dict[str, Any] = {}
        self.load_config()

    def load_config(self) -> bool:
        """Load configuration from JSON file with fallback to defaults"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
                return True
            else:
                print(f"[CONFIG] Configuration file not found: {self.config_path}")
                self.config = self._get_default_config()
                self.save_config()
                return True
        except Exception as e:
            print(f"[CONFIG] Failed to load configuration: {e}")
            self.config = self._get_default_config()
            return False

    def save_config(self) -> bool:
        """Save current configuration to JSON file"""
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)

            # Update last_updated timestamp
            self.config['context_interceptor']['last_updated'] = datetime.now(timezone.utc).isoformat()

            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[CONFIG] Failed to save configuration: {e}")
            return False

    def get_current_mode(self) -> str:
        """Get the current operational mode"""
        return self.config.get('context_interceptor', {}).get('mode', 'shadow')

    def get_mode_config(self, mode: Optional[str] = None) -> Dict[str, Any]:
        """Get configuration for specific mode or current mode"""
        target_mode = mode or self.get_current_mode()
        return self.config.get('modes', {}).get(target_mode, {})

    def set_mode(self, mode: str, reason: str = "Manual mode change") -> Tuple[bool, str]:
        """
        Set operational mode with validation and safety checks

        Args:
            mode: Target mode (shadow, hybrid, full, emergency)
            reason: Reason for mode change (for logging)

        Returns:
            Tuple of (success: bool, message: str)
        """
        valid_modes = ['shadow', 'hybrid', 'full', 'emergency']

        if mode not in valid_modes:
            return False, f"Invalid mode '{mode}'. Valid modes: {', '.join(valid_modes)}"

        # Safety checks before mode change
        if mode != 'emergency':
            safety_check = self.validate_system_safety()
            if not safety_check[0]:
                return False, f"Safety validation failed: {safety_check[1]}"

        # Progressive rollout validation
        if not self._validate_progressive_rollout(mode):
            return False, f"Progressive rollout criteria not met for mode '{mode}'"

        # Update configuration
        current_mode = self.get_current_mode()
        self.config['context_interceptor']['mode'] = mode

        # Log mode change
        self._log_mode_change(current_mode, mode, reason)

        # Save configuration
        if self.save_config():
            print(f"[CONFIG] Mode changed from '{current_mode}' to '{mode}': {reason}")
            return True, f"Successfully changed to mode '{mode}'"
        else:
            # Revert on save failure
            self.config['context_interceptor']['mode'] = current_mode
            return False, "Failed to save configuration - mode change reverted"

    def validate_system_safety(self) -> Tuple[bool, str]:
        """
        Validate system safety before enabling enhanced context operations

        Returns:
            Tuple of (is_safe: bool, message: str)
        """
        try:
            # Check if Enhanced Memory Bridge is available
            bridge_path = self.config.get('integration_settings', {}).get(
                'enhanced_memory_bridge_path',
                './scripts/memory-bridge-runner.js'
            )

            full_bridge_path = os.path.join(self.project_root, bridge_path)
            if not os.path.exists(full_bridge_path):
                return False, f"Enhanced Memory Bridge not found: {full_bridge_path}"

            # Test Enhanced Memory Bridge health
            try:
                result = subprocess.run(
                    ['node', full_bridge_path, 'health-check'],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    cwd=self.project_root
                )

                if result.returncode != 0:
                    return False, f"Enhanced Memory Bridge health check failed: {result.stderr}"

                # Parse health check response
                try:
                    health_data = json.loads(result.stdout)
                    if not health_data.get('success', False):
                        return False, f"Enhanced Memory Bridge unhealthy: {health_data.get('error', 'Unknown error')}"
                except json.JSONDecodeError:
                    return False, "Invalid health check response from Enhanced Memory Bridge"

            except subprocess.TimeoutExpired:
                return False, "Enhanced Memory Bridge health check timed out"
            except subprocess.SubprocessError as e:
                return False, f"Enhanced Memory Bridge test failed: {e}"

            # Check safety validator availability
            if self.config.get('safety_settings', {}).get('context_poisoning_detection', True):
                validator_path = os.path.join(
                    self.project_root,
                    'src/core/semantic-memory/context-safety-validator.ts'
                )
                if not os.path.exists(validator_path):
                    return False, f"Context Safety Validator not found: {validator_path}"

            # Check for emergency rollback system
            rollback_path = os.path.join(
                self.project_root,
                '.claude/emergency/context-rollback.sh'
            )
            if not os.path.exists(rollback_path):
                return False, f"Emergency rollback system not found: {rollback_path}"

            return True, "System safety validation passed"

        except Exception as e:
            return False, f"Safety validation error: {e}"

    def _validate_progressive_rollout(self, target_mode: str) -> bool:
        """Validate progressive rollout criteria for mode transitions"""
        current_mode = self.get_current_mode()

        # Emergency mode can always be activated
        if target_mode == 'emergency':
            return True

        # Shadow mode can always be activated from emergency
        if target_mode == 'shadow':
            return True

        # Hybrid mode requires shadow mode success
        if target_mode == 'hybrid' and current_mode not in ['shadow', 'hybrid', 'full']:
            return False

        # Full mode requires hybrid mode success
        if target_mode == 'full' and current_mode not in ['hybrid', 'full']:
            return False

        return True

    def get_safety_settings(self) -> Dict[str, Any]:
        """Get current safety settings"""
        return self.config.get('safety_settings', {})

    def get_performance_settings(self) -> Dict[str, Any]:
        """Get current performance settings"""
        return self.config.get('performance_settings', {})

    def get_logging_settings(self) -> Dict[str, Any]:
        """Get current logging settings"""
        return self.config.get('logging_settings', {})

    def should_enable_context_replacement(self) -> bool:
        """Check if context replacement should be enabled based on current mode"""
        mode_config = self.get_mode_config()
        return mode_config.get('context_replacement', False)

    def should_enable_enhanced_memory(self) -> bool:
        """Check if Enhanced Memory should be enabled based on current mode"""
        mode_config = self.get_mode_config()
        return mode_config.get('enhanced_memory_enabled', False)

    def get_timeout_ms(self) -> int:
        """Get timeout in milliseconds for current mode"""
        mode_config = self.get_mode_config()
        return mode_config.get('timeout_ms', 30000)

    def should_fallback_to_native(self) -> bool:
        """Check if fallback to native context is enabled"""
        mode_config = self.get_mode_config()
        return mode_config.get('fallback_to_native', True)

    def trigger_emergency_mode(self, reason: str) -> Tuple[bool, str]:
        """
        Trigger emergency mode (immediate fallback to native context)

        Args:
            reason: Reason for emergency activation

        Returns:
            Tuple of (success: bool, message: str)
        """
        print(f"[CONFIG] EMERGENCY MODE TRIGGERED: {reason}")

        # Set emergency mode
        result = self.set_mode('emergency', f"EMERGENCY: {reason}")

        if result[0]:
            # Execute emergency rollback script
            try:
                rollback_path = os.path.join(
                    self.project_root,
                    '.claude/emergency/context-rollback.sh'
                )

                if os.path.exists(rollback_path):
                    subprocess.run(['bash', rollback_path], check=True, cwd=self.project_root)
                    print(f"[CONFIG] Emergency rollback script executed successfully")
                else:
                    print(f"[CONFIG] Warning: Emergency rollback script not found")

            except subprocess.SubprocessError as e:
                print(f"[CONFIG] Warning: Emergency rollback script failed: {e}")

        return result

    def _log_mode_change(self, from_mode: str, to_mode: str, reason: str):
        """Log mode change for audit trail"""
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': 'mode_change',
            'from_mode': from_mode,
            'to_mode': to_mode,
            'reason': reason
        }

        try:
            log_path = os.path.join(self.project_root, 'logs/context-interceptor.log')
            os.makedirs(os.path.dirname(log_path), exist_ok=True)

            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"[CONFIG] Warning: Failed to log mode change: {e}")

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration for Context Interceptor"""
        return {
            "context_interceptor": {
                "enabled": True,
                "mode": "shadow",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "description": "Context7-compliant Context Interceptor Configuration"
            },
            "modes": {
                "shadow": {
                    "description": "Parallel Enhanced Memory testing - no context replacement",
                    "enhanced_memory_enabled": True,
                    "context_replacement": False,
                    "logging_enabled": True,
                    "performance_monitoring": True,
                    "safety_validation": True,
                    "fallback_to_native": True,
                    "timeout_ms": 30000
                },
                "emergency": {
                    "description": "Emergency fallback to native context only",
                    "enhanced_memory_enabled": False,
                    "context_replacement": False,
                    "logging_enabled": False,
                    "performance_monitoring": False,
                    "safety_validation": False,
                    "fallback_to_native": True,
                    "timeout_ms": 5000
                }
            },
            "safety_settings": {
                "max_context_size": 32000,
                "context_poisoning_detection": True,
                "adversarial_pattern_detection": True,
                "context_rot_detection": True,
                "performance_degradation_threshold": 0.2,
                "automatic_emergency_fallback": True,
                "safety_violation_cooldown_minutes": 30
            },
            "integration_settings": {
                "enhanced_memory_bridge_path": "./scripts/memory-bridge-runner.js",
                "context_safety_validator_enabled": True,
                "performance_monitor_enabled": True,
                "session_tracking_enabled": True,
                "cross_session_continuity": True
            }
        }

# CLI Interface
def main():
    """CLI interface for Context Interceptor Configuration Manager"""
    if len(sys.argv) < 2:
        print("Usage: python3 context-interceptor-config-manager.py <command> [args]")
        print("\nCommands:")
        print("  status                    - Show current status and configuration")
        print("  set-mode <mode> [reason]  - Set operational mode")
        print("  safety-check             - Perform system safety validation")
        print("  emergency [reason]       - Trigger emergency mode")
        print("  validate                 - Validate configuration")
        print("\nModes: shadow, hybrid, full, emergency")
        sys.exit(1)

    config_manager = ContextInterceptorConfigManager()
    command = sys.argv[1].lower()

    try:
        if command == 'status':
            current_mode = config_manager.get_current_mode()
            mode_config = config_manager.get_mode_config()

            print(f"Current Mode: {current_mode}")
            print(f"Description: {mode_config.get('description', 'No description')}")
            print(f"Enhanced Memory: {'Enabled' if config_manager.should_enable_enhanced_memory() else 'Disabled'}")
            print(f"Context Replacement: {'Enabled' if config_manager.should_enable_context_replacement() else 'Disabled'}")
            print(f"Timeout: {config_manager.get_timeout_ms()}ms")
            print(f"Fallback to Native: {'Yes' if config_manager.should_fallback_to_native() else 'No'}")

        elif command == 'set-mode':
            if len(sys.argv) < 3:
                print("Error: Mode required")
                sys.exit(1)

            mode = sys.argv[2]
            reason = " ".join(sys.argv[3:]) if len(sys.argv) > 3 else "CLI mode change"

            result = config_manager.set_mode(mode, reason)
            if result[0]:
                print(f"Success: {result[1]}")
            else:
                print(f"Error: {result[1]}")
                sys.exit(1)

        elif command == 'safety-check':
            result = config_manager.validate_system_safety()
            if result[0]:
                print(f"Safety Check: PASSED - {result[1]}")
            else:
                print(f"Safety Check: FAILED - {result[1]}")
                sys.exit(1)

        elif command == 'emergency':
            reason = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "Manual emergency activation"
            result = config_manager.trigger_emergency_mode(reason)
            if result[0]:
                print(f"Emergency Mode: {result[1]}")
            else:
                print(f"Emergency Mode Failed: {result[1]}")
                sys.exit(1)

        elif command == 'validate':
            if config_manager.load_config():
                print("Configuration: Valid")
            else:
                print("Configuration: Invalid or missing - defaults loaded")
                sys.exit(1)

        else:
            print(f"Unknown command: {command}")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()