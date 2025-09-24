"""
Complete E2E Playwright test suite for task and batch operations workflow.
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 4.1 exactly.
"""

import asyncio
import pytest
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from typing import Tuple, Optional
import os
from datetime import datetime


class TestEnvironment:
    """Test environment configuration"""
    
    BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3000")
    USERNAME = os.getenv("TEST_USERNAME", "testuser")
    PASSWORD = os.getenv("TEST_PASSWORD", "testpass")
    
    # Test data
    TASK_TITLE = "E2E Test Task"
    TASK_DESCRIPTION = "This is a test task created by Playwright"
    BATCH_NAME = "E2E Test Batch"
    BATCH_DESCRIPTION = "This is a test batch created by Playwright"


class PlaywrightTestManager:
    """Manager for Playwright test lifecycle"""
    
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
    
    async def __aenter__(self) -> Tuple[Browser, BrowserContext, Page]:
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=not bool(os.getenv("DEBUG_MODE", False))
        )
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()
        return self.browser, self.context, self.page
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


@pytest.mark.asyncio
async def test_complete_task_workflow():
    """Test complete task creation and management workflow"""
    
    async with PlaywrightTestManager() as (browser, context, page):
        env = TestEnvironment()
        
        # Step 1: Navigate to login page
        await page.goto(f"{env.BASE_URL}/login")
        await page.wait_for_load_state("networkidle")
        
        # Step 2: Login with credentials
        await page.fill("input[name='username']", env.USERNAME)
        await page.fill("input[name='password']", env.PASSWORD)
        await page.click("button[type='submit']")
        
        # Wait for navigation to dashboard
        await page.wait_for_url(f"{env.BASE_URL}/dashboard")
        await page.wait_for_load_state("networkidle")
        
        # Step 3: Navigate to tasks page
        await page.click("a[href='/tasks']")
        await page.wait_for_url(f"{env.BASE_URL}/tasks")
        await page.wait_for_load_state("networkidle")
        
        # Step 4: Create new task
        await page.click("button[data-testid='create-task-button']")
        await page.wait_for_selector("form[data-testid='task-form']")
        
        # Fill task form
        await page.fill("input[name='title']", env.TASK_TITLE)
        await page.fill("textarea[name='description']", env.TASK_DESCRIPTION)
        await page.select_option("select[name='priority']", "medium")
        
        # Submit form
        await page.click("button[type='submit']")
        await page.wait_for_load_state("networkidle")
        
        # Verify task was created
        task_created = await page.is_visible(f"text='{env.TASK_TITLE}'")
        assert task_created, "Task was not created successfully"
        
        # Step 5: Edit the task
        await page.click(f"button[data-testid='edit-task-{env.TASK_TITLE}']")
        await page.wait_for_selector("form[data-testid='task-form']")
        
        # Update task description
        updated_description = f"{env.TASK_DESCRIPTION} - Updated at {datetime.now().strftime('%H:%M:%S')}"
        await page.fill("textarea[name='description']", updated_description)
        await page.click("button[type='submit']")
        await page.wait_for_load_state("networkidle")
        
        # Verify task was updated
        description_updated = await page.is_visible(f"text='{updated_description}'")
        assert description_updated, "Task description was not updated"
        
        # Step 6: Mark task as complete
        await page.click(f"button[data-testid='complete-task-{env.TASK_TITLE}']")
        await page.wait_for_timeout(1000)  # Wait for animation
        
        # Verify task is marked as complete
        task_completed = await page.is_visible(f"div[data-testid='completed-task-{env.TASK_TITLE}']")
        assert task_completed, "Task was not marked as complete"
        
        # Step 7: Delete the task
        await page.click(f"button[data-testid='delete-task-{env.TASK_TITLE}']")
        await page.wait_for_selector("div[data-testid='confirm-dialog']")
        await page.click("button[data-testid='confirm-delete']")
        await page.wait_for_load_state("networkidle")
        
        # Verify task was deleted
        task_deleted = await page.is_hidden(f"text='{env.TASK_TITLE}'")
        assert task_deleted, "Task was not deleted"


@pytest.mark.asyncio
async def test_batch_operations_workflow():
    """Test batch operations workflow"""
    
    async with PlaywrightTestManager() as (browser, context, page):
        env = TestEnvironment()
        
        # Step 1: Login (reuse login flow)
        await page.goto(f"{env.BASE_URL}/login")
        await page.wait_for_load_state("networkidle")
        await page.fill("input[name='username']", env.USERNAME)
        await page.fill("input[name='password']", env.PASSWORD)
        await page.click("button[type='submit']")
        await page.wait_for_url(f"{env.BASE_URL}/dashboard")
        await page.wait_for_load_state("networkidle")
        
        # Step 2: Navigate to batches page
        await page.click("a[href='/batches']")
        await page.wait_for_url(f"{env.BASE_URL}/batches")
        await page.wait_for_load_state("networkidle")
        
        # Step 3: Create new batch
        await page.click("button[data-testid='create-batch-button']")
        await page.wait_for_selector("form[data-testid='batch-form']")
        
        # Fill batch form
        await page.fill("input[name='name']", env.BATCH_NAME)
        await page.fill("textarea[name='description']", env.BATCH_DESCRIPTION)
        
        # Submit form
        await page.click("button[type='submit']")
        await page.wait_for_load_state("networkidle")
        
        # Verify batch was created
        batch_created = await page.is_visible(f"text='{env.BATCH_NAME}'")
        assert batch_created, "Batch was not created successfully"
        
        # Step 4: Add tasks to batch
        await page.click(f"button[data-testid='view-batch-{env.BATCH_NAME}']")
        await page.wait_for_url(f"{env.BASE_URL}/batches/*")
        await page.wait_for_load_state("networkidle")
        
        # Create multiple tasks for batch
        tasks_to_add = ["Task 1", "Task 2", "Task 3"]
        for task_title in tasks_to_add:
            await page.click("button[data-testid='add-task-to-batch']")
            await page.wait_for_selector("form[data-testid='task-form']")
            await page.fill("input[name='title']", task_title)
            await page.fill("textarea[name='description']", f"Description for {task_title}")
            await page.select_option("select[name='priority']", "high")
            await page.click("button[type='submit']")
            await page.wait_for_load_state("networkidle")
        
        # Verify tasks were added
        for task_title in tasks_to_add:
            task_added = await page.is_visible(f"text='{task_title}'")
            assert task_added, f"Task {task_title} was not added to batch"
        
        # Step 5: Execute batch operations
        # Select all tasks
        await page.click("input[data-testid='select-all-tasks']")
        
        # Perform bulk action - mark as in progress
        await page.select_option("select[data-testid='bulk-action-selector']", "in-progress")
        await page.click("button[data-testid='apply-bulk-action']")
        await page.wait_for_timeout(1000)
        
        # Verify bulk action was applied
        for task_title in tasks_to_add:
            status_updated = await page.is_visible(
                f"span[data-testid='task-status-{task_title}']:has-text('In Progress')"
            )
            assert status_updated, f"Task {task_title} status was not updated"
        
        # Step 6: Complete all tasks in batch
        await page.click("input[data-testid='select-all-tasks']")
        await page.select_option("select[data-testid='bulk-action-selector']", "complete")
        await page.click("button[data-testid='apply-bulk-action']")
        await page.wait_for_timeout(1000)
        
        # Verify all tasks are completed
        for task_title in tasks_to_add:
            task_completed = await page.is_visible(
                f"span[data-testid='task-status-{task_title}']:has-text('Completed')"
            )
            assert task_completed, f"Task {task_title} was not marked as completed"
        
        # Step 7: Delete batch
        await page.goto(f"{env.BASE_URL}/batches")
        await page.wait_for_load_state("networkidle")
        await page.click(f"button[data-testid='delete-batch-{env.BATCH_NAME}']")
        await page.wait_for_selector("div[data-testid='confirm-dialog']")
        await page.click("button[data-testid='confirm-delete']")
        await page.wait_for_load_state("networkidle")
        
        # Verify batch was deleted
        batch_deleted = await page.is_hidden(f"text='{env.BATCH_NAME}'")
        assert batch_deleted, "Batch was not deleted"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])