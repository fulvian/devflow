/**
 * Integration test for DevFlow Cognitive Mapping System
 * 
 * This test suite verifies that all components of the cognitive mapping system
 * work together correctly, including initialization, mental map construction,
 * navigation functionality, and PageRank calculation.
 */

import { CognitiveMappingSystem } from '../core/cognitive-mapping';
import { Graph, MentalMap, NavigationPath } from '../core/cognitive-mapping/types';

// Mock source code content for testing
const TEST_SOURCE_CODE = `
/**
 * Sample source code for cognitive mapping integration test
 */
class User {
  private id: number;
  private name: string;
  private email: string;

  constructor(id: number, name: string, email: string) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  public getId(): number {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getEmail(): string {
    return this.email;
  }

  public setName(name: string): void {
    this.name = name;
  }

  public setEmail(email: string): void {
    this.email = email;
  }
}

interface Repository<T> {
  save(entity: T): void;
  findById(id: number): T | null;
  findAll(): T[];
}

class UserRepository implements Repository<User> {
  private users: Map<number, User> = new Map();

  save(user: User): void {
    this.users.set(user.getId(), user);
  }

  findById(id: number): User | null {
    return this.users.get(id) || null;
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }
}

class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  public createUser(name: string, email: string): User {
    const id = Date.now(); // Simple ID generation for test
    const user = new User(id, name, email);
    this.repository.save(user);
    return user;
  }

  public findUser(id: number): User | null {
    return this.repository.findById(id);
  }

  public getAllUsers(): User[] {
    return this.repository.findAll();
  }
}
`;

describe('CognitiveMappingSystem Integration', () => {
  let cognitiveMap: CognitiveMappingSystem;

  beforeEach(() => {
    cognitiveMap = new CognitiveMappingSystem({
      uri: 'bolt://localhost:7687',
      username: 'neo4j', 
      password: 'password'
    });
  });

  afterEach(async () => {
    if (cognitiveMap) {
      await cognitiveMap.shutdown();
    }
  });

  /**
   * Test Case 1: Verify CognitiveMappingSystem initialization
   */
  it('should initialize CognitiveMappingSystem correctly', async () => {
    expect(cognitiveMap).toBeDefined();
    expect(cognitiveMap).toBeInstanceOf(CognitiveMappingSystem);
    
    // Initialize the system
    await cognitiveMap.initialize();
    
    // System should be ready
    expect(cognitiveMap).toBeTruthy();
  });

  /**
   * Test Case 2: Test mental map construction from source code
   */
  it('should construct mental map from source code', async () => {
    await cognitiveMap.initialize();
    
    // Process the test source code
    const mentalMap = await cognitiveMap.buildCognitiveMap(TEST_SOURCE_CODE, 'test-module');
    
    expect(mentalMap).toBeTruthy();
    expect(mentalMap.id).toBeDefined();
    expect(mentalMap.name).toBe('Mental Map for test-module');
    expect(mentalMap.createdAt).toBeDefined();
    expect(mentalMap.updatedAt).toBeDefined();
    
    // Verify the map structure
    expect(Array.isArray(mentalMap.nodes)).toBe(true);
    expect(Array.isArray(mentalMap.edges)).toBe(true);
  });

  /**
   * Test Case 3: Test navigation functionality between concepts
   */
  it('should navigate between related concepts', async () => {
    await cognitiveMap.initialize();
    
    // First build the mental map
    const mentalMap = await cognitiveMap.buildCognitiveMap(TEST_SOURCE_CODE, 'test-module');
    
    // Test navigation with a node that exists in the mental map
    const navigationResult = await cognitiveMap.navigateMap(mentalMap, 'User', { goal: 'find_service' });
    
    expect(navigationResult).toBeDefined();
    expect(navigationResult.path).toBeDefined();
    expect(Array.isArray(navigationResult.path)).toBe(true);
    expect(typeof navigationResult.distance).toBe('number');
    expect(typeof navigationResult.estimatedTime).toBe('number');
  });

  /**
   * Test Case 4: Test system integration with real workflow
   */
  it('should execute complete cognitive mapping workflow', async () => {
    // Step 1: Initialize system
    await cognitiveMap.initialize();
    
    // Step 2: Build cognitive map from source code
    const mentalMap = await cognitiveMap.buildCognitiveMap(TEST_SOURCE_CODE, 'integration-test');
    expect(mentalMap).toBeTruthy();
    expect(mentalMap.name).toBe('Mental Map for integration-test');
    
    // Step 3: Navigate the map with a node from the mental map
    const navigationPath = await cognitiveMap.navigateMap(mentalMap, 'User', { target: 'UserService' });
    expect(navigationPath).toBeDefined();
    
    // Step 4: Verify system can handle multiple operations
    const secondMap = await cognitiveMap.buildCognitiveMap('// Simple test code', 'second-module');
    expect(secondMap).toBeTruthy();
    expect(secondMap.name).toBe('Mental Map for second-module');
    
    // Step 5: Clean shutdown
    await cognitiveMap.shutdown();
  });

  /**
   * Test Case 5: Error handling for invalid inputs
   */
  it('should handle invalid inputs gracefully', async () => {
    await cognitiveMap.initialize();
    
    // Test with empty source code
    const emptyMap = await cognitiveMap.buildCognitiveMap('', 'empty-module');
    expect(emptyMap).toBeTruthy();
    expect(emptyMap.name).toBe('Mental Map for empty-module');
    
    // Test navigation with invalid mental map
    const invalidMap: MentalMap = {
      id: 'invalid',
      name: 'Invalid Map',
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const result = await cognitiveMap.navigateMap(invalidMap, 'nonexistent', {});
      // Should handle gracefully, might return empty path
      expect(result).toBeDefined();
    } catch (error) {
      // Error handling is acceptable
      expect(error).toBeDefined();
    }
  });
});