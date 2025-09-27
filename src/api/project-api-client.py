#!/usr/bin/env python3
"""
Project API Client - Context7 Compliant
Provides HTTP API access for hook system instead of direct database access
"""

import json
import asyncio
import aiohttp
from typing import Dict, Any, Optional, List
import time
import logging

class ProjectAPIClient:
    """Context7 compliant API client for project lifecycle operations"""

    def __init__(self, base_url: str = "http://localhost:3003", timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        if not self.session:
            raise RuntimeError("API client not initialized. Use async context manager.")

        url = f"{self.base_url}{endpoint}"

        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise APIError(f"API error {response.status}: {error_text}")

        except aiohttp.ClientError as e:
            raise APIError(f"Connection error: {str(e)}")
        except json.JSONDecodeError as e:
            raise APIError(f"JSON decode error: {str(e)}")

    # Project Operations
    async def create_project(self, name: str, description: str = "", status: str = "planning") -> Dict[str, Any]:
        """Create a new project via API"""
        data = {
            "name": name,
            "description": description,
            "state": status
        }

        return await self._request(
            "POST",
            "/projects",
            json=data,
            headers={"Content-Type": "application/json"}
        )

    async def get_projects(self) -> List[Dict[str, Any]]:
        """Get all projects via API"""
        result = await self._request("GET", "/projects")
        return result.get("projects", [])

    async def get_project_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get project by name"""
        projects = await self.get_projects()
        for project in projects:
            if project.get("name") == name:
                return project
        return None

    async def update_project_progress(self, project_id: int, progress: int) -> Dict[str, Any]:
        """Update project progress"""
        data = {"progress": progress}
        return await self._request(
            "PUT",
            f"/projects/{project_id}",
            json=data,
            headers={"Content-Type": "application/json"}
        )

    # Plan Operations
    async def create_plan(self, project_id: int, name: str, description: str = "") -> Dict[str, Any]:
        """Create a new plan for a project"""
        data = {
            "project_id": project_id,
            "name": name,
            "description": description
        }

        return await self._request(
            "POST",
            "/plans",
            json=data,
            headers={"Content-Type": "application/json"}
        )

    async def get_plans(self, project_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get plans, optionally filtered by project"""
        endpoint = "/plans"
        if project_id:
            endpoint += f"?project_id={project_id}"

        result = await self._request("GET", endpoint)
        return result.get("plans", [])

    async def advance_plan(self, plan_id: int) -> Dict[str, Any]:
        """Advance plan to next phase"""
        phases = ["planning", "design", "development", "testing", "deployment", "completed"]

        # Get current plan
        plans = await self.get_plans()
        current_plan = None
        for plan in plans:
            if plan.get("id") == plan_id:
                current_plan = plan
                break

        if not current_plan:
            raise APIError(f"Plan {plan_id} not found")

        current_phase = current_plan.get("phase", "planning")
        try:
            current_index = phases.index(current_phase)
            if current_index < len(phases) - 1:
                next_phase = phases[current_index + 1]
            else:
                next_phase = "completed"
        except ValueError:
            next_phase = "development"

        # Update plan phase
        data = {"phase": next_phase}
        return await self._request(
            "PUT",
            f"/plans/{plan_id}",
            json=data,
            headers={"Content-Type": "application/json"}
        )

    # Task Operations
    async def create_task(self, plan_id: int, name: str, description: str = "") -> Dict[str, Any]:
        """Create a new task"""
        data = {
            "plan_id": plan_id,
            "name": name,
            "description": description
        }

        return await self._request(
            "POST",
            "/tasks",
            json=data,
            headers={"Content-Type": "application/json"}
        )

    async def complete_task(self, task_name: str, project_name: str) -> Dict[str, Any]:
        """Mark a task as completed"""
        # Find project
        project = await self.get_project_by_name(project_name)
        if not project:
            raise APIError(f"Project '{project_name}' not found")

        # Find plans for project
        plans = await self.get_plans(project["id"])
        if not plans:
            raise APIError(f"No plans found for project '{project_name}'")

        # For now, use first plan - could be made more sophisticated
        plan = plans[0]

        # Create completed task
        return await self.create_task(
            plan["id"],
            task_name,
            f"Task completed at {time.strftime('%Y-%m-%d %H:%M:%S')}"
        )

    # Health Check
    async def health_check(self) -> bool:
        """Check if API is responsive"""
        try:
            result = await self._request("GET", "/health")
            return result.get("status") == "ok"
        except:
            return False


class APIError(Exception):
    """Custom exception for API errors"""
    pass


# Context7 Compliant Integration Functions
async def devflow_create_project(name: str, description: str = "") -> Dict[str, Any]:
    """Context7 compliant project creation"""
    async with ProjectAPIClient() as client:
        return await client.create_project(name, description)

async def devflow_complete_task(task_name: str, project_name: str = "Sviluppo Applicazione") -> Dict[str, Any]:
    """Context7 compliant task completion"""
    async with ProjectAPIClient() as client:
        return await client.complete_task(task_name, project_name)

async def devflow_advance_plan(project_name: str = "Sviluppo Applicazione") -> Dict[str, Any]:
    """Context7 compliant plan advancement"""
    async with ProjectAPIClient() as client:
        project = await client.get_project_by_name(project_name)
        if not project:
            raise APIError(f"Project '{project_name}' not found")

        plans = await client.get_plans(project["id"])
        if not plans:
            raise APIError(f"No plans found for project '{project_name}'")

        # Advance first active plan
        active_plan = None
        for plan in plans:
            if plan.get("phase") != "completed":
                active_plan = plan
                break

        if not active_plan:
            raise APIError("No active plans to advance")

        return await client.advance_plan(active_plan["id"])

async def devflow_update_progress(progress: int, project_name: str = "Sviluppo Applicazione") -> Dict[str, Any]:
    """Context7 compliant progress update"""
    async with ProjectAPIClient() as client:
        project = await client.get_project_by_name(project_name)
        if not project:
            raise APIError(f"Project '{project_name}' not found")

        return await client.update_project_progress(project["id"], progress)

async def devflow_project_status(project_name: str = "Sviluppo Applicazione") -> Dict[str, Any]:
    """Context7 compliant project status"""
    async with ProjectAPIClient() as client:
        project = await client.get_project_by_name(project_name)
        if not project:
            raise APIError(f"Project '{project_name}' not found")

        plans = await client.get_plans(project["id"])

        return {
            "project": project,
            "plans": plans,
            "status": "active" if plans else "no_plans"
        }