"""
Command - Core module for command representation and processing
"""
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
from enum import Enum
import uuid

class CommandType(Enum):
    QUERY = "query"
    ACTION = "action"
    BATCH = "batch"
    SYSTEM = "system"

class CommandStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class Command:
    """Represents a command in the system"""
    id: str
    text: str
    command_type: CommandType = CommandType.QUERY
    parameters: Dict[str, Any] = None
    status: CommandStatus = CommandStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.metadata is None:
            self.metadata = {}
        if not self.id:
            self.id = str(uuid.uuid4())

class CommandProcessor:
    """Processes commands and manages their lifecycle"""

    def __init__(self):
        self.commands: Dict[str, Command] = {}

    def create_command(self, text: str, command_type: CommandType = CommandType.QUERY,
                      parameters: Dict[str, Any] = None) -> Command:
        """Create a new command"""
        command = Command(
            id=str(uuid.uuid4()),
            text=text,
            command_type=command_type,
            parameters=parameters or {}
        )
        self.commands[command.id] = command
        return command

    def process_command(self, command: Command) -> Any:
        """Process a command and return result"""
        command.status = CommandStatus.PROCESSING

        try:
            # Simulate command processing logic
            if command.command_type == CommandType.QUERY:
                result = self._process_query(command)
            elif command.command_type == CommandType.ACTION:
                result = self._process_action(command)
            elif command.command_type == CommandType.BATCH:
                result = self._process_batch(command)
            else:
                result = self._process_system(command)

            command.result = result
            command.status = CommandStatus.COMPLETED
            return result

        except Exception as e:
            command.error = str(e)
            command.status = CommandStatus.FAILED
            raise

    def _process_query(self, command: Command) -> Dict[str, Any]:
        """Process a query command"""
        return {
            "type": "query_result",
            "query": command.text,
            "data": f"Mock data for: {command.text}"
        }

    def _process_action(self, command: Command) -> Dict[str, Any]:
        """Process an action command"""
        return {
            "type": "action_result",
            "action": command.text,
            "success": True,
            "message": f"Action executed: {command.text}"
        }

    def _process_batch(self, command: Command) -> Dict[str, Any]:
        """Process a batch command"""
        return {
            "type": "batch_result",
            "batch_id": command.id,
            "processed_count": len(command.parameters.get("commands", [])),
            "success": True
        }

    def _process_system(self, command: Command) -> Dict[str, Any]:
        """Process a system command"""
        return {
            "type": "system_result",
            "system_command": command.text,
            "status": "executed"
        }

    def get_command(self, command_id: str) -> Optional[Command]:
        """Get command by ID"""
        return self.commands.get(command_id)

    def list_commands(self, status_filter: Optional[CommandStatus] = None) -> List[Command]:
        """List commands, optionally filtered by status"""
        commands = list(self.commands.values())
        if status_filter:
            commands = [c for c in commands if c.status == status_filter]
        return commands