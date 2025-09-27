#!/usr/bin/env python3

"""
Critical Issues Monitoring Daemon
Background monitoring system for real-time issue detection
"""

import os
import sys
import json
import time
import sqlite3
from datetime import datetime
from pathlib import Path
import hashlib
import subprocess

class CriticalIssuesMonitor:
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"
        self.config_path = Path(__file__).parent.parent / "config" / "critical-issues-config.json"
        self.log_file = self.project_root / "logs" / "critical-issues-monitor.log"
        
        # Ensure logs directory exists
        self.log_file.parent.mkdir(exist_ok=True)
        
        self.load_config()
        
    def load_config(self):
        """Load monitoring configuration"""
        try:
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
        except Exception as e:
            self.config = {
                "monitoring_interval": 30,
                "patterns": {
                    "security": ["password", "secret", "api_key", "private_key"],
                    "performance": ["O(n²)", "nested_loop", "recursive_without_memo"],
                    "technical_debt": ["TODO", "FIXME", "HACK", "XXX"]
                },
                "severity_thresholds": {
                    "high": 3,
                    "critical": 5
                }
            }
            self.log(f"Config load failed: {e}, using defaults")
    
    def log(self, message):
        """Log message with timestamp"""
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {message}\n"
        
        with open(self.log_file, 'a') as f:
            f.write(log_entry)
        print(log_entry.strip())
    
    def scan_recent_changes(self):
        """Scan for recent file changes and detect issues"""
        try:
            # Get recent git changes
            result = subprocess.run(
                ['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            
            changed_files = result.stdout.strip().split('\n') if result.stdout.strip() else []
            
            issues_detected = []
            for file_path in changed_files:
                if file_path and self.should_scan_file(file_path):
                    file_issues = self.scan_file(file_path)
                    issues_detected.extend(file_issues)
            
            return issues_detected
            
        except Exception as e:
            self.log(f"Error scanning recent changes: {e}")
            return []
    
    def should_scan_file(self, file_path):
        """Determine if file should be scanned"""
        extensions = ['.ts', '.js', '.py', '.md', '.json']
        return any(file_path.endswith(ext) for ext in extensions)
    
    def scan_file(self, file_path):
        """Scan individual file for critical issues"""
        issues = []
        full_path = self.project_root / file_path
        
        if not full_path.exists():
            return issues
            
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            for category, patterns in self.config['patterns'].items():
                for pattern in patterns:
                    if pattern.lower() in content.lower():
                        issue = self.create_issue_data(
                            file_path, pattern, category, content
                        )
                        issues.append(issue)
                        
        except Exception as e:
            self.log(f"Error scanning {file_path}: {e}")
            
        return issues
    
    def create_issue_data(self, file_path, pattern, category, content):
        """Create issue data structure"""
        issue_id = hashlib.md5(f"{file_path}:{pattern}:{category}".encode()).hexdigest()[:16]
        
        # Determine severity based on category and pattern frequency
        pattern_count = content.lower().count(pattern.lower())
        severity = "low"
        if pattern_count >= self.config['severity_thresholds']['critical']:
            severity = "critical"
        elif pattern_count >= self.config['severity_thresholds']['high']:
            severity = "high"
        elif pattern_count > 1:
            severity = "medium"
        
        return {
            'id': f"CI-{issue_id}",
            'title': f"{category.title()} Pattern Detected: {pattern}",
            'description': f"Pattern '{pattern}' found {pattern_count} times in {file_path}",
            'severity': severity,
            'category': category,
            'context': file_path,
            'hash': issue_id,
            'pattern_count': pattern_count
        }
    
    def save_issues_to_db(self, issues):
        """Save detected issues to database"""
        if not issues:
            return
            
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            for issue in issues:
                # Check if issue already exists
                cursor.execute(
                    "SELECT id FROM critical_issues WHERE pattern_hash = ?",
                    (issue['hash'],)
                )
                
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO critical_issues 
                        (id, title, description, severity, category, project_context, pattern_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        issue['id'], issue['title'], issue['description'],
                        issue['severity'], issue['category'], issue['context'], issue['hash']
                    ))
                    self.log(f"Saved new critical issue: {issue['title']}")
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.log(f"Database error: {e}")
    
    def run_monitoring_cycle(self):
        """Run single monitoring cycle"""
        self.log("Starting monitoring cycle...")
        
        issues = self.scan_recent_changes()
        if issues:
            self.log(f"Detected {len(issues)} potential issues")
            self.save_issues_to_db(issues)
        else:
            self.log("No new issues detected")
    
    def start_daemon(self):
        """Start continuous monitoring daemon"""
        self.log("Critical Issues Monitor starting...")
        
        try:
            while True:
                self.run_monitoring_cycle()
                time.sleep(self.config['monitoring_interval'])
                
        except KeyboardInterrupt:
            self.log("Monitor stopped by user")
        except Exception as e:
            self.log(f"Monitor error: {e}")

if __name__ == "__main__":
    monitor = CriticalIssuesMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        monitor.run_monitoring_cycle()
    else:
        monitor.start_daemon()