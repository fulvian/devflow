#!/usr/bin/env python3
"""
Project Lifecycle Management Hook for Natural Language Commands

This module provides an automatic hook for managing project lifecycles through
natural language commands. It integrates with ProjectLifecycleManager via API
and supports automatic triggering on user input.
"""

import re
import json
import logging
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass
from abc import ABC, abstractmethod

import requests
from requests.exceptions import RequestException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProjectState(Enum):
    """Enumeration of possible project states"""
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"

class CommandIntent(Enum):
    """Enumeration of recognized command intents"""
    CREATE_PROJECT = "create_project"
    COMPLETE_TASK = "complete_task"
    ADVANCE_PLAN = "advance_plan"
    UPDATE_PROGRESS = "update_progress"
    GET_STATUS = "get_status"
    UNKNOWN = "unknown"

@dataclass
class ParsedCommand:
    """Data class for parsed natural language commands"""
    intent: CommandIntent
    entities: Dict[str, str]
    confidence: float

class IntentRecognizer:
    """Recognizes user intents from natural language commands"""
    
    def __init__(self):
        # Define patterns for intent recognition
        self.patterns = {
            CommandIntent.CREATE_PROJECT: [
                r"crea progetto\s+(?P<name>[\w\s]+)",
                r"nuovo progetto\s+(?P<name>[\w\s]+)",
                r"inizia progetto\s+(?P<name>[\w\s]+)"
            ],
            CommandIntent.COMPLETE_TASK: [
                r"completa task\s+(?P<task>[\w\s]+)",
                r"finisci task\s+(?P<task>[\w\s]+)",
                r"termina attività\s+(?P<task>[\w\s]+)"
            ],
            CommandIntent.ADVANCE_PLAN: [
                r"avanza piano",
                r"procedi con il piano",
                r"passa alla fase successiva"
            ],
            CommandIntent.UPDATE_PROGRESS: [
                r"aggiorna avanzamento\s+(?P<progress>\d+%)",
                r"stato progetto\s+(?P<progress>\d+%)",
                r"progresso\s+(?P<progress>\d+%)"
            ],
            CommandIntent.GET_STATUS: [
                r"stato progetto",
                r"come sta andando il progetto",
                r"progresso attuale"
            ]
        }
    
    def recognize_intent(self, user_input: str) -> ParsedCommand:
        """
        Recognize the intent from user input using pattern matching
        
        Args:
            user_input (str): Natural language command from user
            
        Returns:
            ParsedCommand: Parsed command with intent and entities
        """
        user_input = user_input.lower().strip()
        
        for intent, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, user_input)
                if match:
                    entities = match.groupdict() if match.groups() else {}
                    return ParsedCommand(
                        intent=intent,
                        entities=entities,
                        confidence=0.9  # Simplified confidence score
                    )
        
        return ParsedCommand(
            intent=CommandIntent.UNKNOWN,
            entities={},
            confidence=0.1
        )

class ProjectLifecycleManagerAPI:
    """API client for ProjectLifecycleManager"""
    
    def __init__(self, base_url: str, api_key: str):
        """
        Initialize the API client
        
        Args:
            base_url (str): Base URL for the ProjectLifecycleManager API
            api_key (str): API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """
        Make an HTTP request to the API
        
        Args:
            method (str): HTTP method (GET, POST, PUT, DELETE)
            endpoint (str): API endpoint
            data (Optional[Dict]): Request data
            
        Returns:
            Dict: Response data
            
        Raises:
            RequestException: If the request fails
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def create_project(self, name: str, description: str = "") -> Dict:
        """Create a new project"""
        data = {
            "name": name,
            "description": description,
            "state": ProjectState.PLANNING.value
        }
        return self._make_request("POST", "/projects", data)
    
    def complete_task(self, project_id: str, task_name: str) -> Dict:
        """Mark a task as completed"""
        data = {
            "task_name": task_name,
            "status": "completed"
        }
        return self._make_request("PUT", f"/projects/{project_id}/tasks", data)
    
    def advance_project_state(self, project_id: str) -> Dict:
        """Advance the project to the next state"""
        return self._make_request("POST", f"/projects/{project_id}/advance")
    
    def update_progress(self, project_id: str, progress: Optional[int] = None) -> Dict:
        """Update project progress"""
        data = {}
        if progress is not None:
            data["progress"] = progress
        return self._make_request("PUT", f"/projects/{project_id}/progress", data)
    
    def get_project_status(self, project_id: str) -> Dict:
        """Get current project status"""
        return self._make_request("GET", f"/projects/{project_id}")

class NotificationService:
    """Service for sending notifications about project progress"""
    
    def send_notification(self, message: str, recipient: str) -> None:
        """
        Send a notification message to a recipient
        
        Args:
            message (str): Notification message
            recipient (str): Recipient identifier
        """
        # In a real implementation, this would integrate with email, Slack, etc.
        logger.info(f"Notification to {recipient}: {message}")

class ProjectLifecycleHook:
    """Main hook for managing project lifecycles through natural language commands"""
    
    def __init__(self, api_client: ProjectLifecycleManagerAPI, 
                 intent_recognizer: Optional[IntentRecognizer] = None,
                 notification_service: Optional[NotificationService] = None):
        """
        Initialize the project lifecycle hook
        
        Args:
            api_client (ProjectLifecycleManagerAPI): API client for project management
            intent_recognizer (Optional[IntentRecognizer]): Intent recognizer component
            notification_service (Optional[NotificationService]): Notification service
        """
        self.api_client = api_client
        self.intent_recognizer = intent_recognizer or IntentRecognizer()
        self.notification_service = notification_service or NotificationService()
        self.current_project_id = None  # In a real implementation, this would be more sophisticated
    
    def process_command(self, user_input: str) -> str:
        """
        Process a natural language command and execute appropriate action
        
        Args:
            user_input (str): Natural language command from user
            
        Returns:
            str: Response message
        """
        logger.info(f"Processing command: {user_input}")
        
        # Recognize intent from user input
        parsed_command = self.intent_recognizer.recognize_intent(user_input)
        
        if parsed_command.intent == CommandIntent.UNKNOWN:
            return "Non ho capito il comando. Puoi riprovare?"
        
        try:
            # Execute action based on recognized intent
            response = self._execute_intent(parsed_command)
            
            # Log the action
            logger.info(f"Executed intent {parsed_command.intent.value}: {response}")
            
            return response
        except Exception as e:
            logger.error(f"Error executing command: {e}")
            return "Si è verificato un errore durante l'esecuzione del comando."
    
    def _execute_intent(self, parsed_command: ParsedCommand) -> str:
        """
        Execute the appropriate action based on the parsed command
        
        Args:
            parsed_command (ParsedCommand): Parsed command with intent and entities
            
        Returns:
            str: Response message
        """
        intent = parsed_command.intent
        entities = parsed_command.entities
        
        if intent == CommandIntent.CREATE_PROJECT:
            name = entities.get("name", "Progetto senza nome")
            result = self.api_client.create_project(name)
            self.current_project_id = result.get("id")
            return f"Progetto '{name}' creato con successo!"
        
        elif intent == CommandIntent.COMPLETE_TASK:
            if not self.current_project_id:
                return "Nessun progetto attivo. Crea prima un progetto."
            
            task_name = entities.get("task", "attività")
            self.api_client.complete_task(self.current_project_id, task_name)
            return f"Task '{task_name}' completato."
        
        elif intent == CommandIntent.ADVANCE_PLAN:
            if not self.current_project_id:
                return "Nessun progetto attivo. Crea prima un progetto."
            
            result = self.api_client.advance_project_state(self.current_project_id)
            new_state = result.get("state", "sconosciuto")
            return f"Piano avanzato. Nuovo stato: {new_state}"
        
        elif intent == CommandIntent.UPDATE_PROGRESS:
            if not self.current_project_id:
                return "Nessun progetto attivo. Crea prima un progetto."
            
            progress_str = entities.get("progress")
            progress = None
            if progress_str:
                progress = int(progress_str.rstrip('%'))
            
            self.api_client.update_progress(self.current_project_id, progress)
            
            if progress is not None:
                message = f"Avanzamento aggiornato al {progress}%"
                # Send notification about progress update
                self.notification_service.send_notification(
                    message, "project_team"
                )
                return message
            else:
                return "Avanzamento aggiornato."
        
        elif intent == CommandIntent.GET_STATUS:
            if not self.current_project_id:
                return "Nessun progetto attivo. Crea prima un progetto."
            
            status = self.api_client.get_project_status(self.current_project_id)
            progress = status.get("progress", "N/A")
            state = status.get("state", "N/A")
            return f"Stato del progetto: {state}, Avanzamento: {progress}%"
        
        return "Comando non supportato."

# Example usage
if __name__ == "__main__":
    # Initialize components
    api_client = ProjectLifecycleManagerAPI(
        base_url="http://localhost:3003",
        api_key="your-api-key-here"
    )
    
    hook = ProjectLifecycleHook(api_client)
    
    # Example commands
    commands = [
        "crea progetto Sviluppo Applicazione",
        "completa task Analisi requisiti",
        "avanza piano",
        "aggiorna avanzamento 25%",
        "stato progetto"
    ]
    
    for command in commands:
        response = hook.process_command(command)
        print(f"Input: {command}")
        print(f"Output: {response}\n")
