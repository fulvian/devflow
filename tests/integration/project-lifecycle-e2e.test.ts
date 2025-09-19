/**
 * Complete End-to-End Test Suite for Project Lifecycle Management Automation
 * 
 * This test suite validates the complete workflow of the Project Lifecycle Management system,
 * including project hierarchy creation, state progression, API integration, Claude Code hooks,
 * real-time notifications, and performance under load.
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from '@jest/globals';
import { ProjectLifecycleManager } from '../src/managers/ProjectLifecycleManager';
import { ProjectAPI } from '../src/api/ProjectAPI';
import { ClaudeCodeHook } from '../src/hooks/ClaudeCodeHook';
import { NotificationService } from '../src/services/NotificationService';
import { DatabaseManager } from '../src/database/DatabaseManager';
import { Project, ProjectStatus } from '../src/models/Project';
import { WebSocketClient } from '../src/clients/WebSocketClient';
import { LoadTester } from '../src/testing/LoadTester';

// Test database configuration
const TEST_DB_PATH = ':memory:'; // In-memory SQLite for testing

describe('Project Lifecycle Management - End-to-End Tests', () => {
  let dbManager: DatabaseManager;
  let projectManager: ProjectLifecycleManager;
  let projectAPI: ProjectAPI;
  let claudeHook: ClaudeCodeHook;
  let notificationService: NotificationService;
  let wsClient: WebSocketClient;
  let loadTester: LoadTester;

  beforeAll(async () => {
    // Initialize test database
    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();

    // Initialize system components
    projectManager = new ProjectLifecycleManager(dbManager);
    projectAPI = new ProjectAPI(projectManager);
    claudeHook = new ClaudeCodeHook();
    notificationService = new NotificationService();
    wsClient = new WebSocketClient('ws://localhost:3001');
    loadTester = new LoadTester(projectAPI);

    // Connect WebSocket client for real-time notifications
    await wsClient.connect();
  });

  afterAll(async () => {
    // Cleanup connections
    await wsClient.disconnect();
    await dbManager.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await dbManager.clearAllTables();
  });

  describe('Project Hierarchy Creation', () => {
    it('should create a project hierarchy from natural language commands', async () => {
      // Simulate natural language command
      const naturalCommand = "Create a new software project called 'E-commerce Platform' with sub-projects for frontend, backend, and database design";

      // Process command through API
      const response = await projectAPI.processNaturalCommand(naturalCommand);
      
      // Validate API response
      expect(response.success).toBe(true);
      expect(response.project).toBeDefined();
      expect(response.project.name).toBe('E-commerce Platform');
      
      // Verify project hierarchy was created
      const mainProject = await projectManager.getProjectById(response.project.id);
      expect(mainProject).toBeDefined();
      expect(mainProject.name).toBe('E-commerce Platform');
      
      // Check sub-projects were created
      const subProjects = await projectManager.getSubProjects(mainProject.id);
      expect(subProjects).toHaveLength(3);
      expect(subProjects.map(p => p.name)).toEqual(
        expect.arrayContaining(['frontend', 'backend', 'database design'])
      );
    });

    it('should handle complex project hierarchies with nested sub-projects', async () => {
      const command = `
        Create project "Enterprise System" with:
        - Frontend (React)
          - User Interface
          - Admin Panel
        - Backend (Node.js)
          - API Layer
          - Business Logic
          - Data Access
        - Infrastructure
          - CI/CD Pipeline
          - Monitoring
      `;

      const response = await projectAPI.processNaturalCommand(command);
      expect(response.success).toBe(true);

      const mainProject = await projectManager.getProjectById(response.project.id);
      const level1SubProjects = await projectManager.getSubProjects(mainProject.id);
      
      expect(level1SubProjects).toHaveLength(3);
      
      // Verify nested structure
      const frontend = level1SubProjects.find(p => p.name.includes('Frontend'));
      const backend = level1SubProjects.find(p => p.name.includes('Backend'));
      const infrastructure = level1SubProjects.find(p => p.name.includes('Infrastructure'));
      
      expect(frontend).toBeDefined();
      expect(backend).toBeDefined();
      expect(infrastructure).toBeDefined();
      
      // Check frontend sub-projects
      const frontendSubs = await projectManager.getSubProjects(frontend.id);
      expect(frontendSubs.map(p => p.name)).toEqual(
        expect.arrayContaining(['User Interface', 'Admin Panel'])
      );
      
      // Check backend sub-projects
      const backendSubs = await projectManager.getSubProjects(backend.id);
      expect(backendSubs.map(p => p.name)).toEqual(
        expect.arrayContaining(['API Layer', 'Business Logic', 'Data Access'])
      );
    });
  });

  describe('Project State Progression', () => {
    let projectId: string;

    beforeEach(async () => {
      // Create a test project for state progression tests
      const response = await projectAPI.processNaturalCommand(
        "Create project 'Task Management System'"
      );
      projectId = response.project.id;
    });

    it('should advance project through all lifecycle states', async () => {
      // Initial state should be PLANNING
      let project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.PLANNING);

      // Advance to DESIGN state
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);
      project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.DESIGN);

      // Advance to DEVELOPMENT state
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT);
      project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.DEVELOPMENT);

      // Advance to TESTING state
      await projectManager.advanceProjectState(projectId, ProjectStatus.TESTING);
      project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.TESTING);

      // Advance to DEPLOYMENT state
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEPLOYMENT);
      project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.DEPLOYMENT);

      // Advance to COMPLETED state
      await projectManager.advanceProjectState(projectId, ProjectStatus.COMPLETED);
      project = await projectManager.getProjectById(projectId);
      expect(project.status).toBe(ProjectStatus.COMPLETED);
    });

    it('should validate state transitions according to workflow rules', async () => {
      // Should not allow skipping states
      await expect(
        projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT)
      ).rejects.toThrow('Invalid state transition');

      // Should not allow moving backwards
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);
      await expect(
        projectManager.advanceProjectState(projectId, ProjectStatus.PLANNING)
      ).rejects.toThrow('Cannot transition to previous state');

      // Should allow valid transitions
      await expect(
        projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT)
      ).resolves.not.toThrow();
    });
  });

  describe('Claude Code Hook Integration', () => {
    it('should trigger code generation hook on DESIGN state', async () => {
      // Create project and advance to DESIGN state
      const response = await projectAPI.processNaturalCommand(
        "Create project 'API Gateway' with backend components"
      );
      
      const projectId = response.project.id;
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);

      // Verify Claude Code hook was triggered
      const hookCalls = await claudeHook.getHookCallsForProject(projectId);
      expect(hookCalls).toHaveLength(1);
      expect(hookCalls[0].eventType).toBe('design_completed');
      
      // Verify generated artifacts
      const artifacts = await projectManager.getProjectArtifacts(projectId);
      expect(artifacts.some(a => a.type === 'code_structure')).toBe(true);
      expect(artifacts.some(a => a.type === 'api_specification')).toBe(true);
    });

    it('should generate implementation stubs on DEVELOPMENT state', async () => {
      const response = await projectAPI.processNaturalCommand(
        "Create project 'User Authentication Service'"
      );
      
      const projectId = response.project.id;
      
      // Advance through states to trigger hooks
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT);

      // Verify implementation stubs were generated
      const artifacts = await projectManager.getProjectArtifacts(projectId);
      const stubs = artifacts.filter(a => a.type === 'implementation_stub');
      expect(stubs.length).toBeGreaterThan(0);
      
      // Verify stub content
      stubs.forEach(stub => {
        expect(stub.content).toContain('function');
        expect(stub.content).toContain('// TODO: Implementation');
      });
    });
  });

  describe('Real-time Notifications', () => {
    it('should send notifications on project state changes', async () => {
      const notifications: any[] = [];
      
      // Listen for notifications
      wsClient.on('project_status_changed', (data) => {
        notifications.push(data);
      });

      // Create project and change states
      const response = await projectAPI.processNaturalCommand(
        "Create project 'Notification Service'"
      );
      
      const projectId = response.project.id;
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT);

      // Wait for notifications to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify notifications were sent
      expect(notifications).toHaveLength(2);
      expect(notifications[0].projectId).toBe(projectId);
      expect(notifications[0].status).toBe(ProjectStatus.DESIGN);
      expect(notifications[1].status).toBe(ProjectStatus.DEVELOPMENT);
    });

    it('should notify stakeholders on project completion', async () => {
      const completionNotifications: any[] = [];
      
      wsClient.on('project_completed', (data) => {
        completionNotifications.push(data);
      });

      const response = await projectAPI.processNaturalCommand(
        "Create project 'Data Migration Tool'"
      );
      
      const projectId = response.project.id;
      
      // Advance through all states to completion
      await projectManager.advanceProjectState(projectId, ProjectStatus.DESIGN);
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEVELOPMENT);
      await projectManager.advanceProjectState(projectId, ProjectStatus.TESTING);
      await projectManager.advanceProjectState(projectId, ProjectStatus.DEPLOYMENT);
      await projectManager.advanceProjectState(projectId, ProjectStatus.COMPLETED);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(completionNotifications).toHaveLength(1);
      expect(completionNotifications[0].projectId).toBe(projectId);
      expect(completionNotifications[0].status).toBe(ProjectStatus.COMPLETED);
    });
  });

  describe('API Response Validation', () => {
    it('should return proper error responses for invalid requests', async () => {
      // Test invalid natural language command
      const invalidResponse = await projectAPI.processNaturalCommand('');
      expect(invalidResponse.success).toBe(false);
      expect(invalidResponse.error).toBeDefined();
      expect(invalidResponse.error.code).toBe('INVALID_INPUT');

      // Test non-existent project access
      const projectResponse = await projectAPI.getProjectById('non-existent-id');
      expect(projectResponse.success).toBe(false);
      expect(projectResponse.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should provide consistent response structure', async () => {
      const response = await projectAPI.processNaturalCommand(
        "Create project 'API Response Test'"
      );
      
      // Validate response structure
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('requestId');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.timestamp).toBe('number');
      expect(typeof response.requestId).toBe('string');
      
      if (response.success) {
        expect(response).toHaveProperty('project');
        expect(response.project).toHaveProperty('id');
        expect(response.project).toHaveProperty('name');
        expect(response.project).toHaveProperty('status');
      } else {
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');
      }
    });
  });

  describe('Load Testing and Performance', () => {
    it('should handle concurrent project creation requests', async () => {
      const concurrentRequests = 10;
      const results = await loadTester.runConcurrentProjectCreations(
        concurrentRequests,
        "Create project 'Load Test Project'"
      );

      // Verify all requests completed successfully
      expect(results.successful).toBe(concurrentRequests);
      expect(results.failed).toBe(0);
      
      // Verify response times are within acceptable limits (under 2 seconds)
      results.responseTimes.forEach(time => {
        expect(time).toBeLessThan(2000);
      });
    });

    it('should maintain performance under state transition load', async () => {
      // Create multiple projects
      const projectCount = 5;
      const projects: Project[] = [];
      
      for (let i = 0; i < projectCount; i++) {
        const response = await projectAPI.processNaturalCommand(
          `Create project 'Performance Test Project ${i}'`
        );
        projects.push(response.project);
      }

      // Measure state transition performance
      const startTime = Date.now();
      
      // Advance all projects through multiple states concurrently
      const transitionPromises = projects.flatMap(project => [
        projectManager.advanceProjectState(project.id, ProjectStatus.DESIGN),
        projectManager.advanceProjectState(project.id, ProjectStatus.DEVELOPMENT),
        projectManager.advanceProjectState(project.id, ProjectStatus.TESTING)
      ]);
      
      await Promise.all(transitionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time (under 5 seconds for 15 transitions)
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('Test Data Cleanup', () => {
    it('should automatically clean up test projects after completion', async () => {
      // Create several test projects
      const testProjects: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const response = await projectAPI.processNaturalCommand(
          `Create temporary test project ${i}`
        );
        testProjects.push(response.project.id);
      }

      // Verify projects exist
      for (const projectId of testProjects) {
        const project = await projectManager.getProjectById(projectId);
        expect(project).toBeDefined();
      }

      // Run cleanup
      await projectManager.cleanupTestProjects();

      // Verify projects were removed
      for (const projectId of testProjects) {
        const project = await projectManager.getProjectById(projectId);
        expect(project).toBeNull();
      }
    });

    it('should preserve non-test projects during cleanup', async () => {
      // Create a test project
      const testResponse = await projectAPI.processNaturalCommand(
        "Create temporary project for testing"
      );
      
      // Create a permanent project
      const permResponse = await projectAPI.processNaturalCommand(
        "Create permanent project 'Production System'"
      );
      await projectManager.markProjectAsPermanent(permResponse.project.id);

      // Run cleanup
      await projectManager.cleanupTestProjects();

      // Verify test project was removed
      const testProject = await projectManager.getProjectById(testResponse.project.id);
      expect(testProject).toBeNull();

      // Verify permanent project was preserved
      const permProject = await projectManager.getProjectById(permResponse.project.id);
      expect(permProject).toBeDefined();
      expect(permProject.name).toBe('Production System');
    });
  });
});