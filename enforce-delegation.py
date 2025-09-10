# Zero Touch Architecture - Four-Level Enforcement System
import re
import time
from typing import List, Dict, Any

class ZeroTouchEnforcer:
    def __init__(self):
        self.level_1_whitelist = {
            'Read', 'Glob', 'Grep', 'mcp__', 'Task', 'TodoWrite', 
            'WebFetch', 'WebSearch'
        }
        
        self.level_2_blocked_patterns = [
            r'\b(mv|rm|cp|mkdir|touch|echo\s*>|>>|sed|awk|chmod|chown)\b',
            r'\.(js|ts|py|json|md|sql|css|html)$'
        ]
        
        self.level_3_delegation_triggers = [
            'implement', 'write', 'modify', 'create', 'update', 'delete',
            'function', 'class', 'method', 'component'
        ]
        
        self.level_4_code_indicators = [
            r'```[a-z]*\n', r'function\s+\w+\s*\(', r'class\s+\w+',
            r'import\s+\w+', r'export\s+\w+', r'const\s+\w+',
            r'let\s+\w+', r'var\s+\w+'
        ]
        
        self.last_command_time = 0
        self.cooling_period = 5  # seconds
    
    def level_1_check(self, tool_name: str) -> bool:
        """Block all tools except whitelisted read-only tools"""
        return tool_name in self.level_1_whitelist
    
    def level_2_check(self, command: str) -> bool:
        """Block modification commands via regex patterns"""
        for pattern in self.level_2_blocked_patterns:
            if re.search(pattern, command):
                return False
        return True
    
    def level_3_check(self, task_description: str) -> bool:
        """Enforce delegation for code-related tasks"""
        task_lower = task_description.lower()
        for trigger in self.level_3_delegation_triggers:
            if trigger in task_lower:
                return False  # Delegation required
        return True
    
    def level_4_check(self, context: str) -> bool:
        """Context awareness for code writing intent"""
        for indicator in self.level_4_code_indicators:
            if re.search(indicator, context, re.IGNORECASE):
                return False  # Code intent detected
        return True
    
    def cooling_off_check(self) -> bool:
        """Implement cooling off period"""
        current_time = time.time()
        if current_time - self.last_command_time < self.cooling_period:
            return False
        self.last_command_time = current_time
        return True
    
    def enforce(self, tool_name: str, command: str, task_description: str, context: str) -> Dict[str, Any]:
        """Main enforcement method applying all four levels"""
        result = {
            'allowed': True,
            'level_violated': None,
            'reason': '',
            'delegation_required': False
        }
        
        # Level 1: Tool whitelist
        if not self.level_1_check(tool_name):
            result['allowed'] = False
            result['level_violated'] = 1
            result['reason'] = f'Tool {tool_name} not in whitelist'
            return result
        
        # Level 2: Command pattern blocking
        if not self.level_2_check(command):
            result['allowed'] = False
            result['level_violated'] = 2
            result['reason'] = 'Modification command detected'
            return result
        
        # Level 3: Delegation enforcement
        if not self.level_3_check(task_description):
            result['allowed'] = False
            result['level_violated'] = 3
            result['reason'] = 'Code-related task requires delegation'
            result['delegation_required'] = True
            return result
        
        # Level 4: Context awareness
        if not self.level_4_check(context):
            result['allowed'] = False
            result['level_violated'] = 4
            result['reason'] = 'Code writing intent detected'
            result['delegation_required'] = True
            return result
        
        # Cooling off period
        if not self.cooling_off_check():
            result['allowed'] = False
            result['level_violated'] = 4
            result['reason'] = 'Cooling off period not elapsed'
            return result
        
        return result

# Example usage
def main():
    enforcer = ZeroTouchEnforcer()
    
    # Test case 1: Allowed read operation
    result = enforcer.enforce('Read', 'cat file.txt', 'Read configuration', 'Show config')
    print(f'Test 1: {result}')
    
    # Test case 2: Blocked write operation
    result = enforcer.enforce('Write', 'echo data > file.txt', 'Write data', 'Save config')
    print(f'Test 2: {result}')
    
    # Test case 3: Code implementation request
    result = enforcer.enforce('Task', '', 'Implement new feature', '```javascript\nfunction test() {}\n```')
    print(f'Test 3: {result}')

if __name__ == '__main__':
    main()
