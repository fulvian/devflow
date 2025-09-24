#!/usr/bin/env python3
"""
WORKAROUND per BUG Claude Code PostToolUse Hook Triggering
Soluzione alternativa che monitora attivamente invece di aspettare trigger

GitHub Issues: #3148, #3179, #6403, #5314
"""

import sqlite3
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import threading
import os
import signal
import sys

class MemoryStreamActiveMonitor:
    """Monitor attivo che bypassa i bug di triggering di Claude Code"""

    def __init__(self):
        self.db_path = Path('./data/devflow_unified.sqlite')
        self.log_path = Path('./temp/memory-active-monitor.log')
        self.state_file = Path('./temp/monitor-state.json')
        self.running = True

        # Monitored locations
        self.monitored_paths = [
            Path('./src'),
            Path('./packages'),
            Path('./.claude'),
            Path('./temp'),
            Path('./scripts')
        ]

        # File state cache
        self.file_states = {}
        self.load_state()

    def log(self, message: str):
        """Logging robusto"""
        try:
            self.log_path.parent.mkdir(exist_ok=True, parents=True)
            timestamp = datetime.now().isoformat()
            with open(self.log_path, "a", encoding='utf-8') as f:
                f.write(f"[{timestamp}] {message}\n")
            print(f"🧠 {message}")  # Also print to stdout
        except:
            pass

    def load_state(self):
        """Carica stato precedente"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.file_states = data.get('file_states', {})
                    self.log(f"Loaded state for {len(self.file_states)} files")
            else:
                self.log("Starting fresh monitoring")
        except Exception as e:
            self.log(f"Error loading state: {e}")
            self.file_states = {}

    def save_state(self):
        """Salva stato corrente"""
        try:
            self.state_file.parent.mkdir(exist_ok=True, parents=True)
            data = {
                'file_states': self.file_states,
                'last_update': datetime.now().isoformat()
            }
            with open(self.state_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            self.log(f"Error saving state: {e}")

    def scan_for_changes(self):
        """Scansiona per cambiamenti nei file"""
        changes_detected = []

        for base_path in self.monitored_paths:
            if not base_path.exists():
                continue

            # Scan recursively
            for file_path in base_path.rglob('*'):
                if not file_path.is_file():
                    continue

                # Skip binary/temp files
                if file_path.suffix in ['.pyc', '.log', '.tmp', '.cache']:
                    continue

                try:
                    stat = file_path.stat()
                    current_state = {
                        'mtime': stat.st_mtime,
                        'size': stat.st_size,
                        'path': str(file_path)
                    }

                    file_key = str(file_path)

                    if file_key in self.file_states:
                        # Check for changes
                        old_state = self.file_states[file_key]
                        if (current_state['mtime'] != old_state['mtime'] or
                            current_state['size'] != old_state['size']):

                            change_event = {
                                'type': 'file_modified',
                                'path': file_key,
                                'old_state': old_state,
                                'new_state': current_state,
                                'detected_at': datetime.now().isoformat()
                            }
                            changes_detected.append(change_event)
                    else:
                        # New file
                        change_event = {
                            'type': 'file_created',
                            'path': file_key,
                            'state': current_state,
                            'detected_at': datetime.now().isoformat()
                        }
                        changes_detected.append(change_event)

                    # Update state
                    self.file_states[file_key] = current_state

                except Exception as e:
                    continue  # Skip files we can't access

        return changes_detected

    def process_change_event(self, event: Dict[str, Any]):
        """Processa evento di cambiamento"""
        try:
            # Determine significance
            significance = self.calculate_significance(event)

            # Create memory event
            memory_event = {
                'session_id': 'active-monitor',
                'event_type': event['type'],
                'significance_score': significance,
                'context_data': json.dumps(event),
                'tool_name': 'FileSystemMonitor',
                'file_paths': json.dumps([event['path']]),
                'created_at': datetime.now().isoformat()
            }

            # Store in database
            self.store_memory_event(memory_event)

            self.log(f"💾 Captured {event['type']}: {Path(event['path']).name} (significance: {significance:.2f})")

        except Exception as e:
            self.log(f"Error processing change event: {e}")

    def calculate_significance(self, event: Dict[str, Any]) -> float:
        """Calcola significatività"""
        base_score = 0.4
        path = event['path'].lower()

        # Boost for important file types
        if any(ext in path for ext in ['.py', '.js', '.ts', '.jsx', '.tsx']):
            base_score += 0.3
        elif any(ext in path for ext in ['.md', '.json', '.yml', '.yaml']):
            base_score += 0.2
        elif any(ext in path for ext in ['.txt', '.log']):
            base_score += 0.1

        # Boost for important directories
        if any(dir_name in path for dir_name in ['src/', 'hooks/', 'scripts/']):
            base_score += 0.2

        # Boost for new files vs modifications
        if event['type'] == 'file_created':
            base_score += 0.2

        return min(1.0, max(0.1, base_score))

    def store_memory_event(self, event: Dict[str, Any]):
        """Salva evento nel database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO cometa_memory_stream (
                        session_id, event_type, significance_score,
                        context_data, tool_name, file_paths, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    event['session_id'],
                    event['event_type'],
                    event['significance_score'],
                    event['context_data'],
                    event['tool_name'],
                    event['file_paths'],
                    event['created_at']
                ))
                conn.commit()
        except Exception as e:
            self.log(f"Database storage failed: {e}")

    def monitor_loop(self):
        """Loop principale di monitoraggio"""
        self.log("🚀 Starting active memory stream monitor (WORKAROUND for Claude Code bug)")

        try:
            while self.running:
                changes = self.scan_for_changes()

                for change in changes:
                    self.process_change_event(change)

                if changes:
                    self.save_state()

                # Wait before next scan
                time.sleep(2)  # 2-second intervals

        except KeyboardInterrupt:
            self.log("Monitor stopped by user")
        except Exception as e:
            self.log(f"Monitor error: {e}")
        finally:
            self.save_state()
            self.log("Monitor shutdown complete")

    def start_background_monitor(self):
        """Avvia monitor in background"""
        def signal_handler(signum, frame):
            self.running = False

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        monitor_thread = threading.Thread(target=self.monitor_loop, daemon=True)
        monitor_thread.start()

        return monitor_thread

def run_active_monitor():
    """Esegue monitor attivo"""
    monitor = MemoryStreamActiveMonitor()
    monitor.monitor_loop()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        # Run as background daemon
        monitor = MemoryStreamActiveMonitor()
        thread = monitor.start_background_monitor()

        print("🧠 Memory Stream Active Monitor started in background")
        print("   (WORKAROUND for Claude Code PostToolUse hook bugs)")
        print(f"   Monitoring: {len(monitor.monitored_paths)} directories")
        print("   Press Ctrl+C to stop")

        try:
            thread.join()
        except KeyboardInterrupt:
            monitor.running = False
            print("\n🛑 Monitor stopped")
    else:
        # Run normally
        run_active_monitor()