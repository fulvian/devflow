"""
API E2E Test Suite for NLP Workflow

This test suite implements the complete NLP API workflow and task management
via REST API as specified in PIANO_TEST_DEBUG_COMETA_BRAIN.md section 4.2.
"""

import asyncio
import json
import uuid
from typing import Dict, Any, Optional
import httpx
import pytest


class NLPAPIClient:
    """Async HTTP client for NLP API testing"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def post_task(self, payload: Dict[str, Any]) -> httpx.Response:
        """Create a new NLP task"""
        url = f"{self.base_url}/tasks"
        return await self.client.post(url, json=payload)
    
    async def get_task(self, task_id: str) -> httpx.Response:
        """Get task status and results"""
        url = f"{self.base_url}/tasks/{task_id}"
        return await self.client.get(url)
    
    async def get_tasks(self) -> httpx.Response:
        """Get all tasks"""
        url = f"{self.base_url}/tasks"
        return await self.client.get(url)
    
    async def delete_task(self, task_id: str) -> httpx.Response:
        """Delete a task"""
        url = f"{self.base_url}/tasks/{task_id}"
        return await self.client.delete(url)
    
    async def health_check(self) -> httpx.Response:
        """Check API health status"""
        url = f"{self.base_url}/health"
        return await self.client.get(url)


@pytest.fixture
async def api_client():
    """Fixture to provide API client for tests"""
    async with NLPAPIClient("http://localhost:8000") as client:
        yield client


@pytest.fixture
def sample_text_payload():
    """Sample payload for text processing"""
    return {
        "text": "The quick brown fox jumps over the lazy dog. This is a sample text for NLP processing.",
        "processing_options": {
            "sentiment_analysis": True,
            "entity_extraction": True,
            "language_detection": True
        }
    }


class TestNLPWorkflow:
    """Test suite for complete NLP API workflow"""
    
    @pytest.mark.asyncio
    async def test_01_health_check(self, api_client: NLPAPIClient):
        """Test 1: API Health Check"""
        response = await api_client.health_check()
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
    
    @pytest.mark.asyncio
    async def test_02_create_task(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 2: Create NLP Task"""
        response = await api_client.post_task(sample_text_payload)
        assert response.status_code == 201
        data = response.json()
        assert "task_id" in data
        assert "status" in data
        assert data["status"] == "created"
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_03_get_task_status(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 3: Get Task Status"""
        # First create a task
        create_response = await api_client.post_task(sample_text_payload)
        assert create_response.status_code == 201
        task_data = create_response.json()
        task_id = task_data["task_id"]
        
        # Then get the task status
        response = await api_client.get_task(task_id)
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == task_id
        assert "status" in data
        assert "created_at" in data
    
    @pytest.mark.asyncio
    async def test_04_task_processing_lifecycle(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 4: Task Processing Lifecycle"""
        # Create task
        create_response = await api_client.post_task(sample_text_payload)
        assert create_response.status_code == 201
        task_data = create_response.json()
        task_id = task_data["task_id"]
        
        # Poll for completion (with timeout)
        max_attempts = 30
        attempt = 0
        while attempt < max_attempts:
            response = await api_client.get_task(task_id)
            assert response.status_code == 200
            data = response.json()
            
            if data["status"] == "completed":
                # Verify results structure
                assert "results" in data
                results = data["results"]
                assert "sentiment" in results
                assert "entities" in results
                assert "language" in results
                break
            elif data["status"] == "failed":
                pytest.fail(f"Task failed with error: {data.get('error', 'Unknown error')}")
            
            attempt += 1
            await asyncio.sleep(1)  # Wait 1 second between polls
        
        if attempt >= max_attempts:
            pytest.fail("Task did not complete within timeout period")
    
    @pytest.mark.asyncio
    async def test_05_list_all_tasks(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 5: List All Tasks"""
        # Create a task first to ensure there's at least one
        create_response = await api_client.post_task(sample_text_payload)
        assert create_response.status_code == 201
        
        # Get all tasks
        response = await api_client.get_tasks()
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify structure of first task
        first_task = data[0]
        assert "task_id" in first_task
        assert "status" in first_task
        assert "created_at" in first_task
    
    @pytest.mark.asyncio
    async def test_06_delete_task(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 6: Delete Task"""
        # Create a task
        create_response = await api_client.post_task(sample_text_payload)
        assert create_response.status_code == 201
        task_data = create_response.json()
        task_id = task_data["task_id"]
        
        # Delete the task
        response = await api_client.delete_task(task_id)
        assert response.status_code == 204
        
        # Verify task is deleted
        get_response = await api_client.get_task(task_id)
        assert get_response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_07_invalid_task_id(self, api_client: NLPAPIClient):
        """Test 7: Invalid Task ID Handling"""
        invalid_task_id = "invalid-task-id-123"
        response = await api_client.get_task(invalid_task_id)
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
    
    @pytest.mark.asyncio
    async def test_08_empty_text_payload(self, api_client: NLPAPIClient):
        """Test 8: Empty Text Payload Handling"""
        payload = {
            "text": "",
            "processing_options": {
                "sentiment_analysis": True
            }
        }
        response = await api_client.post_task(payload)
        # Depending on implementation, this might be 400 or 201 with error in results
        assert response.status_code in [201, 400]
    
    @pytest.mark.asyncio
    async def test_09_concurrent_task_creation(self, api_client: NLPAPIClient, sample_text_payload: Dict[str, Any]):
        """Test 9: Concurrent Task Creation"""
        # Create multiple tasks concurrently
        tasks = []
        for i in range(3):
            payload = sample_text_payload.copy()
            payload["text"] = f"{sample_text_payload['text']} Additional text {i}"
            task = api_client.post_task(payload)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        
        for response in responses:
            assert response.status_code == 201
            data = response.json()
            assert "task_id" in data
            assert data["status"] == "created"


class TestAPIErrorHandling:
    """Test suite for API error handling"""
    
    @pytest.mark.asyncio
    async def test_missing_text_field(self, api_client: NLPAPIClient):
        """Test missing text field in payload"""
        payload = {
            "processing_options": {
                "sentiment_analysis": True
            }
        }
        response = await api_client.post_task(payload)
        assert response.status_code == 422  # Unprocessable Entity
    
    @pytest.mark.asyncio
    async def test_invalid_processing_options(self, api_client: NLPAPIClient):
        """Test invalid processing options"""
        payload = {
            "text": "Sample text",
            "processing_options": {
                "invalid_option": True
            }
        }
        response = await api_client.post_task(payload)
        # Depending on implementation, might be 400 or 201 with validation error
        assert response.status_code in [201, 400]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])