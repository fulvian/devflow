#!/usr/bin/env python3
"""
Pattern Analyzer for Critical Issues Detection
Analyzes code patterns to detect security, performance, and technical debt issues
"""

import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Set

logger = logging.getLogger('pattern-analyzer')


class PatternAnalyzer:
    def __init__(self):
        self.config = self._load_config()
        self.false_positive_patterns = self._load_false_positive_patterns()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load pattern analysis configuration"""
        return {
            "security_patterns": [
                r"(password|passwd|pwd)\s*=\s*[\"'][^\"']+[\"']",
                r"(secret|token|api_key|access_key)\s*=\s*[\"'][^\"']+[\"']",
                r"process\.env\.(PASSWORD|SECRET|TOKEN|KEY)",
                r"[\"'](BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY)[\"']"
            ],
            "performance_patterns": [
                r"(while|for)\s+True",
                r"for\s+.*\s+in\s+range\(\s*1000000\s*\)",
                r"\.forEach\(.*=>.*\.forEach\(",
                r"(setTimeout|setInterval)\([^,]+,\s*0\s*\)"
            ],
            "technical_debt_patterns": [
                r"(TODO|FIXME|HACK|XXX):",
                r"console\.(log|debug|info|warn|error)\(",
                r"(alert|document\.write)\(",
                r"==\s*(null|undefined)"
            ],
            "severity_weights": {
                "security": 10,
                "performance": 7,
                "technical_debt": 3
            }
        }
    
    def _load_false_positive_patterns(self) -> Set[str]:
        """Load patterns that should be ignored as false positives"""
        return {
            "password = ''",
            "password = \"\"",
            "password = None",
            "secret = ''",
            "secret = \"\"",
            "secret = None",
            "// TODO: Implement"
        }
    
    def _is_false_positive(self, line: str) -> bool:
        """Check if a line is a false positive"""
        line_clean = line.strip().lower()
        for pattern in self.false_positive_patterns:
            if pattern.lower() in line_clean:
                return True
        return False
    
    def _detect_pattern_issues(self, file_path: str, content: str, pattern_type: str, patterns: List[str]) -> List[Dict[str, Any]]:
        """Detect issues based on regex patterns"""
        issues = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            if self._is_false_positive(line):
                continue
                
            for pattern in patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append({
                        "type": pattern_type,
                        "file": file_path,
                        "line": i,
                        "content": line.strip(),
                        "pattern": pattern,
                        "severity": "high" if pattern_type == "security" else "medium" if pattern_type == "performance" else "low"
                    })
        
        return issues
    
    def analyze_file(self, file_path: str, content: str) -> List[Dict[str, Any]]:
        """Analyze a file for critical issues using pattern matching"""
        issues = []
        
        # Security issues
        security_issues = self._detect_pattern_issues(
            file_path, content, "security", 
            self.config.get("security_patterns", [])
        )
        issues.extend(security_issues)
        
        # Performance issues
        performance_issues = self._detect_pattern_issues(
            file_path, content, "performance",
            self.config.get("performance_patterns", [])
        )
        issues.extend(performance_issues)
        
        # Technical debt
        tech_debt_issues = self._detect_pattern_issues(
            file_path, content, "technical_debt",
            self.config.get("technical_debt_patterns", [])
        )
        issues.extend(tech_debt_issues)
        
        return issues
    
    def detect_advanced_patterns(self, file_path: str, content: str) -> List[Dict[str, Any]]:
        """Detect more complex patterns that require context analysis"""
        issues = []
        lines = content.split('\n')
        
        # Detect nested loops that might cause performance issues
        for i, line in enumerate(lines, 1):
            if "for" in line and ":" in line:  # Python for loop
                # Look for nested loops in next few lines
                for j in range(i, min(i+10, len(lines))):
                    nested_line = lines[j-1]
                    if "for" in nested_line and nested_line.strip().startswith(" "):
                        issues.append({
                            "type": "performance",
                            "file": file_path,
                            "line": i,
                            "content": f"Potential nested loop: {line.strip()}",
                            "pattern": "nested_loop",
                            "severity": "medium"
                        })
                        break
            
            # Detect multiple console.log statements
            if "console.log" in line:
                log_count = sum(1 for l in lines[max(0, i-5):i+5] if "console.log" in l)
                if log_count > 3:
                    issues.append({
                        "type": "technical_debt",
                        "file": file_path,
                        "line": i,
                        "content": "Multiple console.log statements in vicinity",
                        "pattern": "excessive_logging",
                        "severity": "low"
                    })
        
        return issues
    
    def filter_false_positives(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply additional filtering to reduce false positives"""
        filtered_issues = []
        
        for issue in issues:
            # Skip test files for technical debt
            if issue["type"] == "technical_debt" and ("test" in issue["file"].lower() or "spec" in issue["file"].lower()):
                continue
            
            # Skip commented out code for security issues
            if issue["type"] == "security" and issue["content"].strip().startswith("#"):
                continue
            
            # Skip documentation files
            if any(ext in issue["file"].lower() for ext in [".md", ".txt", ".rst"]):
                continue
            
            filtered_issues.append(issue)
        
        return filtered_issues
