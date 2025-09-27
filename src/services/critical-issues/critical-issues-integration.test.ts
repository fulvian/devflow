import { CriticalIssuesService } from './critical-issues-service';
import { CriticalIssuesRepository } from './critical-issues.repository';

describe('Critical Issues Integration Tests', () => {
  let service: CriticalIssuesService;

  beforeEach(async () => {
    service = new CriticalIssuesService();
    // Clear repository for clean tests
    const repository = new CriticalIssuesRepository();
    await repository.clear();
  });

  describe('End-to-End Critical Issue Lifecycle', () => {
    it('should handle complete issue lifecycle: create, read, update, stats', async () => {
      // 1. Create multiple issues
      const securityIssueData = {
        type: 'security',
        file: 'auth.ts',
        line: 15,
        content: 'const apiKey = "sk-1234567890abcdef";',
        pattern: 'hardcoded-api-key',
        severity: 'high'
      };

      const performanceIssueData = {
        type: 'performance',
        file: 'query.ts',
        line: 42,
        content: 'SELECT * FROM users;',
        pattern: 'n-plus-one-query',
        severity: 'medium'
      };

      const techDebtIssueData = {
        type: 'technical_debt',
        file: 'legacy.ts',
        line: 1,
        content: '// TODO: Refactor this entire file',
        pattern: 'todo-comment',
        severity: 'low'
      };

      // Create issues
      const securityIssue = await service.createIssue(securityIssueData);
      const performanceIssue = await service.createIssue(performanceIssueData);
      const techDebtIssue = await service.createIssue(techDebtIssueData);

      expect(securityIssue).not.toBeNull();
      expect(performanceIssue).not.toBeNull();
      expect(techDebtIssue).not.toBeNull();

      // 2. Verify all issues were created correctly
      const allIssues = await service.getIssues();
      expect(allIssues).toHaveLength(3);

      // 3. Test filtering by type
      const securityIssues = await service.getIssues({ type: 'security' });
      expect(securityIssues).toHaveLength(1);
      expect(securityIssues[0].type).toBe('security');

      const performanceIssues = await service.getIssues({ type: 'performance' });
      expect(performanceIssues).toHaveLength(1);
      expect(performanceIssues[0].type).toBe('performance');

      // 4. Test filtering by severity
      const highSeverityIssues = await service.getIssues({ severity: 'high' });
      expect(highSeverityIssues).toHaveLength(1);
      expect(highSeverityIssues[0].severity).toBe('high');

      // 5. Test filtering by resolved status
      const unresolvedIssues = await service.getIssues({ resolved: false });
      expect(unresolvedIssues).toHaveLength(3); // All should be unresolved initially

      // 6. Resolve one issue
      const resolveResult = await service.markAsResolved(securityIssue!.id);
      expect(resolveResult).toBe(true);

      // 7. Verify resolved status
      const resolvedIssue = await service.getIssueById(securityIssue!.id);
      expect(resolvedIssue?.resolved).toBe(true);

      // 8. Test filtering after resolution
      const stillUnresolvedIssues = await service.getIssues({ resolved: false });
      expect(stillUnresolvedIssues).toHaveLength(2);

      const resolvedIssues = await service.getIssues({ resolved: true });
      expect(resolvedIssues).toHaveLength(1);
      expect(resolvedIssues[0].id).toBe(securityIssue!.id);

      // 9. Test statistics
      const stats = await service.getIssueStats();
      expect(stats).toEqual({
        total: 3,
        byType: {
          security: 1,
          performance: 1,
          technical_debt: 1
        },
        bySeverity: {
          high: 1,
          medium: 1,
          low: 1
        },
        unresolved: 2
      });
    });

    it('should handle edge cases and error scenarios', async () => {
      // Test getting non-existent issue
      const nonExistentIssue = await service.getIssueById('does-not-exist');
      expect(nonExistentIssue).toBeNull();

      // Test resolving non-existent issue
      const resolveNonExistent = await service.markAsResolved('does-not-exist');
      expect(resolveNonExistent).toBe(false);

      // Test empty filters
      const issuesWithEmptyFilter = await service.getIssues({});
      expect(Array.isArray(issuesWithEmptyFilter)).toBe(true);

      // Test stats with no issues
      const emptyStats = await service.getIssueStats();
      expect(emptyStats).toEqual({
        total: 0,
        byType: {},
        bySeverity: {},
        unresolved: 0
      });
    });

    it('should handle concurrent operations correctly', async () => {
      const issuePromises = [];

      // Create multiple issues concurrently
      for (let i = 0; i < 5; i++) {
        const issueData = {
          type: 'security',
          file: `concurrent-test-${i}.ts`,
          line: i + 1,
          content: `test content ${i}`,
          pattern: 'test-pattern',
          severity: 'medium' as const
        };
        issuePromises.push(service.createIssue(issueData));
      }

      const createdIssues = await Promise.all(issuePromises);

      // Verify all issues were created
      expect(createdIssues).toHaveLength(5);
      createdIssues.forEach(issue => {
        expect(issue).not.toBeNull();
        expect(issue?.type).toBe('security');
      });

      // Verify they all have unique IDs
      const ids = createdIssues.map(issue => issue?.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // Test concurrent resolution
      const resolutionPromises = createdIssues.map(issue =>
        service.markAsResolved(issue!.id)
      );

      const resolutionResults = await Promise.all(resolutionPromises);
      expect(resolutionResults.every(result => result)).toBe(true);

      // Verify all are resolved
      const finalStats = await service.getIssueStats();
      expect(finalStats.unresolved).toBe(0);
      expect(finalStats.total).toBe(5);
    });

    it('should maintain data integrity with complex filtering', async () => {
      // Create a diverse set of issues
      const issueDataSet = [
        { type: 'security', severity: 'high', file: 'auth1.ts' },
        { type: 'security', severity: 'medium', file: 'auth2.ts' },
        { type: 'performance', severity: 'high', file: 'perf1.ts' },
        { type: 'performance', severity: 'low', file: 'perf2.ts' },
        { type: 'technical_debt', severity: 'medium', file: 'debt1.ts' },
      ] as const;

      const createdIssues = [];
      for (const data of issueDataSet) {
        const issueData = {
          ...data,
          line: 1,
          content: 'test content',
          pattern: 'test-pattern'
        };
        const issue = await service.createIssue(issueData);
        createdIssues.push(issue);
      }

      // Resolve some issues
      await service.markAsResolved(createdIssues[0]!.id); // security, high
      await service.markAsResolved(createdIssues[2]!.id); // performance, high

      // Test complex filtering combinations
      const securityHighUnresolved = await service.getIssues({
        type: 'security',
        severity: 'high',
        resolved: false
      });
      expect(securityHighUnresolved).toHaveLength(0); // Should be resolved

      const performanceHighUnresolved = await service.getIssues({
        type: 'performance',
        severity: 'high',
        resolved: false
      });
      expect(performanceHighUnresolved).toHaveLength(0); // Should be resolved

      const unresolvedMediumSeverity = await service.getIssues({
        severity: 'medium',
        resolved: false
      });
      expect(unresolvedMediumSeverity).toHaveLength(2); // security medium + tech debt medium

      // Final verification of data integrity
      const finalStats = await service.getIssueStats();
      expect(finalStats.total).toBe(5);
      expect(finalStats.unresolved).toBe(3);
      expect(finalStats.byType.security).toBe(2);
      expect(finalStats.byType.performance).toBe(2);
      expect(finalStats.byType.technical_debt).toBe(1);
      expect(finalStats.bySeverity.high).toBe(2);
      expect(finalStats.bySeverity.medium).toBe(2);
      expect(finalStats.bySeverity.low).toBe(1);
    });
  });
});