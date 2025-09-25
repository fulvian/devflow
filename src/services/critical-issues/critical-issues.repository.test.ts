import { CriticalIssuesRepository } from './critical-issues.repository';
import { CriticalIssueCreateDto } from './critical-issues.types';

describe('CriticalIssuesRepository', () => {
  let repository: CriticalIssuesRepository;

  beforeEach(async () => {
    repository = new CriticalIssuesRepository();
    await repository.clear();
  });

  afterEach(async () => {
    await repository.clear();
  });

  describe('create', () => {
    it('should create a new critical issue with generated ID', async () => {
      const issueData: CriticalIssueCreateDto = {
        type: 'security',
        file: 'test.ts',
        line: 10,
        content: 'console.log("password")',
        pattern: 'hardcoded-credential',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z',
        resolved: false
      };

      const result = await repository.create(issueData);

      expect(result).toMatchObject(issueData);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('string');
    });

    it('should store created issue for retrieval', async () => {
      const issueData: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'slow.ts',
        line: 5,
        content: 'while(true) {}',
        pattern: 'infinite-loop',
        severity: 'medium',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const created = await repository.create(issueData);
      const retrieved = await repository.findById(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe('find', () => {
    it('should return all issues when no filters provided', async () => {
      const issue1Data: CriticalIssueCreateDto = {
        type: 'security',
        file: 'test1.ts',
        line: 1,
        content: 'test1',
        pattern: 'pattern1',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const issue2Data: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'test2.ts',
        line: 2,
        content: 'test2',
        pattern: 'pattern2',
        severity: 'low',
        timestamp: '2024-01-01T00:00:00Z'
      };

      await repository.create(issue1Data);
      await repository.create(issue2Data);

      const results = await repository.find();

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('security');
      expect(results[1].type).toBe('performance');
    });

    it('should filter by type', async () => {
      const securityIssue: CriticalIssueCreateDto = {
        type: 'security',
        file: 'secure.ts',
        line: 1,
        content: 'security test',
        pattern: 'sec-pattern',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const performanceIssue: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'perf.ts',
        line: 1,
        content: 'perf test',
        pattern: 'perf-pattern',
        severity: 'medium',
        timestamp: '2024-01-01T00:00:00Z'
      };

      await repository.create(securityIssue);
      await repository.create(performanceIssue);

      const securityResults = await repository.find({ type: 'security' });
      const performanceResults = await repository.find({ type: 'performance' });

      expect(securityResults).toHaveLength(1);
      expect(securityResults[0].type).toBe('security');
      expect(performanceResults).toHaveLength(1);
      expect(performanceResults[0].type).toBe('performance');
    });

    it('should filter by severity', async () => {
      const highSeverityIssue: CriticalIssueCreateDto = {
        type: 'security',
        file: 'high.ts',
        line: 1,
        content: 'high severity',
        pattern: 'high-pattern',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const lowSeverityIssue: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'low.ts',
        line: 1,
        content: 'low severity',
        pattern: 'low-pattern',
        severity: 'low',
        timestamp: '2024-01-01T00:00:00Z'
      };

      await repository.create(highSeverityIssue);
      await repository.create(lowSeverityIssue);

      const highResults = await repository.find({ severity: 'high' });
      const lowResults = await repository.find({ severity: 'low' });

      expect(highResults).toHaveLength(1);
      expect(highResults[0].severity).toBe('high');
      expect(lowResults).toHaveLength(1);
      expect(lowResults[0].severity).toBe('low');
    });

    it('should filter by resolved status', async () => {
      const resolvedIssue: CriticalIssueCreateDto = {
        type: 'security',
        file: 'resolved.ts',
        line: 1,
        content: 'resolved',
        pattern: 'pattern',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z',
        resolved: true
      };

      const unresolvedIssue: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'unresolved.ts',
        line: 1,
        content: 'unresolved',
        pattern: 'pattern',
        severity: 'medium',
        timestamp: '2024-01-01T00:00:00Z',
        resolved: false
      };

      await repository.create(resolvedIssue);
      await repository.create(unresolvedIssue);

      const resolvedResults = await repository.find({ resolved: true });
      const unresolvedResults = await repository.find({ resolved: false });

      expect(resolvedResults).toHaveLength(1);
      expect(resolvedResults[0].resolved).toBe(true);
      expect(unresolvedResults).toHaveLength(1);
      expect(unresolvedResults[0].resolved).toBe(false);
    });
  });

  describe('findById', () => {
    it('should return issue when ID exists', async () => {
      const issueData: CriticalIssueCreateDto = {
        type: 'technical_debt',
        file: 'debt.ts',
        line: 42,
        content: 'TODO: refactor this',
        pattern: 'todo-comment',
        severity: 'low',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const created = await repository.create(issueData);
      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null when ID does not exist', async () => {
      const found = await repository.findById('nonexistent-id');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing issue', async () => {
      const issueData: CriticalIssueCreateDto = {
        type: 'security',
        file: 'update.ts',
        line: 1,
        content: 'before update',
        pattern: 'pattern',
        severity: 'medium',
        timestamp: '2024-01-01T00:00:00Z',
        resolved: false
      };

      const created = await repository.create(issueData);
      const updateResult = await repository.update(created.id, { resolved: true });

      expect(updateResult).toBe(true);

      const updated = await repository.findById(created.id);
      expect(updated?.resolved).toBe(true);
    });

    it('should return false when updating nonexistent issue', async () => {
      const updateResult = await repository.update('nonexistent-id', { resolved: true });
      expect(updateResult).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing issue', async () => {
      const issueData: CriticalIssueCreateDto = {
        type: 'security',
        file: 'delete.ts',
        line: 1,
        content: 'to be deleted',
        pattern: 'pattern',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const created = await repository.create(issueData);
      const deleteResult = await repository.delete(created.id);

      expect(deleteResult).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting nonexistent issue', async () => {
      const deleteResult = await repository.delete('nonexistent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all issues', async () => {
      const issue1Data: CriticalIssueCreateDto = {
        type: 'security',
        file: 'test1.ts',
        line: 1,
        content: 'test1',
        pattern: 'pattern1',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const issue2Data: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'test2.ts',
        line: 2,
        content: 'test2',
        pattern: 'pattern2',
        severity: 'low',
        timestamp: '2024-01-01T00:00:00Z'
      };

      await repository.create(issue1Data);
      await repository.create(issue2Data);

      let allIssues = await repository.getAll();
      expect(allIssues).toHaveLength(2);

      await repository.clear();

      allIssues = await repository.getAll();
      expect(allIssues).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all issues without filtering', async () => {
      const issue1Data: CriticalIssueCreateDto = {
        type: 'security',
        file: 'all1.ts',
        line: 1,
        content: 'all test 1',
        pattern: 'pattern1',
        severity: 'high',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const issue2Data: CriticalIssueCreateDto = {
        type: 'performance',
        file: 'all2.ts',
        line: 2,
        content: 'all test 2',
        pattern: 'pattern2',
        severity: 'low',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const created1 = await repository.create(issue1Data);
      const created2 = await repository.create(issue2Data);

      const allIssues = await repository.getAll();

      expect(allIssues).toHaveLength(2);
      expect(allIssues).toContainEqual(created1);
      expect(allIssues).toContainEqual(created2);
    });
  });
});