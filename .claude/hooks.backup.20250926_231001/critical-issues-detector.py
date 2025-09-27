#!/usr/bin/env python3
"""
Critical Issues Detector Hook
Automated detection of critical issues in code changes
"""

import sys
import json
import subprocess
import logging
from pathlib import Path
from typing import List, Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from hooks.pattern_analyzer import PatternAnalyzer
from services.critical_issues_service import CriticalIssuesService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(project_root / '.claude/logs/critical-issues.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('critical-issues-detector')


class CriticalIssuesDetector:
    def __init__(self):
        self.pattern_analyzer = PatternAnalyzer()
        self.critical_issues_service = CriticalIssuesService()
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration for critical issue detection"""
        config_path = project_root / '.claude/config/critical-issues-config.json'
        if config_path.exists():
            with open(config_path, 'r') as f:
                return json.load(f)
        return {
            "enabled": True,
            "patterns": {
                "security": ["password", "secret", "token", "key"],
                "performance": ["while True", "for.*in range\(1000000\)"],
                "technical_debt": ["TODO", "FIXME", "HACK"]
            },
            "file_extensions": [".py", ".js", ".ts", ".jsx", ".tsx"]
        }
    
    def get_staged_files(self) -> List[str]:
        """Get list of staged files for git commit"""
        try:
            result = subprocess.run(
                ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip().split('\n') if result.stdout.strip() else []
        except subprocess.CalledProcessError as e:
            logger.error(f"Error getting staged files: {e}")
            return []
    
    def get_file_content(self, file_path: str) -> str:
        """Get content of a file"""
        try:
            full_path = project_root / file_path
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return ""
    
    def should_analyze_file(self, file_path: str) -> bool:
        """Check if file should be analyzed based on extension"""
        extensions = self.config.get('file_extensions', [])
        return any(file_path.endswith(ext) for ext in extensions)
    
    def detect_issues(self) -> List[Dict[str, Any]]:
        """Main method to detect critical issues in staged files"""
        if not self.config.get('enabled', True):
            logger.info("Critical issues detector is disabled")
            return []
        
        issues = []
        staged_files = self.get_staged_files()
        
        logger.info(f"Analyzing {len(staged_files)} staged files")
        
        for file_path in staged_files:
            if not self.should_analyze_file(file_path):
                continue
                
            content = self.get_file_content(file_path)
            if not content:
                continue
                
            # Run pattern analysis
            file_issues = self.pattern_analyzer.analyze_file(file_path, content)
            issues.extend(file_issues)
            
            # Run advanced pattern detection
            advanced_issues = self.pattern_analyzer.detect_advanced_patterns(file_path, content)
            issues.extend(advanced_issues)
        
        # Filter out false positives
        filtered_issues = self.pattern_analyzer.filter_false_positives(issues)
        
        logger.info(f"Detected {len(filtered_issues)} critical issues")
        return filtered_issues
    
    def create_issue_records(self, issues: List[Dict[str, Any]]) -> None:
        """Create issue records in the database"""
        for issue in issues:
            try:
                self.critical_issues_service.create_issue(issue)
                logger.info(f"Created issue record for {issue['type']} in {issue['file']}")
            except Exception as e:
                logger.error(f"Failed to create issue record: {e}")
    
    def run(self) -> int:
        """Main execution method"""
        try:
            issues = self.detect_issues()
            
            if issues:
                self.create_issue_records(issues)
                
                # Log summary
                issue_types = {}
                for issue in issues:
                    issue_type = issue['type']
                    issue_types[issue_type] = issue_types.get(issue_type, 0) + 1
                
                logger.info(f"Issue summary: {issue_types}")
                
                # For pre-commit hook, we might want to prevent commit for high severity issues
                high_severity_issues = [i for i in issues if i.get('severity', 'medium') == 'high']
                if high_severity_issues:
                    logger.warning(f"Found {len(high_severity_issues)} high severity issues")
                    # Return non-zero to prevent commit if configured
                    # return 1
            
            return 0
        except Exception as e:
            logger.error(f"Error in critical issues detection: {e}")
            return 1


def main():
    detector = CriticalIssuesDetector()
    sys.exit(detector.run())


if __name__ == "__main__":
    main()
