import { CriticalIssuesService } from './critical-issues-service';
import { CriticalIssuesRepository } from './critical-issues.repository';
import { Logger } from '../../utils/logger';

// Mock the dependencies
jest.mock('./critical-issues.repository');
jest.mock('../../utils/logger');

const MockedCriticalIssuesRepository = CriticalIssuesRepository as jest.MockedClass<typeof CriticalIssuesRepository>;
const MockedLogger = Logger as jest.MockedClass<typeof Logger>;

describe('CriticalIssuesService', () => {
  let service: CriticalIssuesService;
  let mockRepository: jest.Mocked<CriticalIssuesRepository>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getAll: jest.fn(),
    } as unknown as jest.Mocked<CriticalIssuesRepository>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    MockedCriticalIssuesRepository.mockImplementation(() => mockRepository);
    MockedLogger.mockImplementation(() => mockLogger);

    service = new CriticalIssuesService();
  });

  describe('createIssue', () => {
    it('should successfully create an issue', async () => {
      const issueData = {
        type: 'security',
        file: 'test.ts',
        line: 10,
        content: 'console.log("password")',
        pattern: 'hardcoded-credential',
        severity: 'high'
      };

      const expectedCreatedIssue = {
        id: 'test-id-123',
        type: 'security',
        file: 'test.ts',
        line: 10,
        content: 'console.log("password")',
        pattern: 'hardcoded-credential',
        severity: 'high' as const,
        timestamp: expect.any(String),
        resolved: false
      };

      mockRepository.create.mockResolvedValue(expectedCreatedIssue);

      const result = await service.createIssue(issueData);

      expect(result).toEqual(expectedCreatedIssue);
      expect(mockRepository.create).toHaveBeenCalledWith({
        type: 'security',
        file: 'test.ts',
        line: 10,
        content: 'console.log("password")',
        pattern: 'hardcoded-credential',
        severity: 'high' as const,
        timestamp: expect.any(String),
        resolved: false
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created critical issue: test-id-123');
    });

    it('should handle missing optional fields with defaults', async () => {
      const issueData = {
        type: 'performance',
        file: 'slow.ts'
      };

      const expectedCreatedIssue = {
        id: 'test-id-456',
        type: 'performance',
        file: 'slow.ts',
        line: 0,
        content: '',
        pattern: '',
        severity: 'medium' as const,
        timestamp: expect.any(String),
        resolved: false
      };

      mockRepository.create.mockResolvedValue(expectedCreatedIssue);

      const result = await service.createIssue(issueData);

      expect(result).toEqual(expectedCreatedIssue);
      expect(mockRepository.create).toHaveBeenCalledWith({
        type: 'performance',
        file: 'slow.ts',
        line: 0,
        content: '',
        pattern: '',
        severity: 'medium' as const,
        timestamp: expect.any(String),
        resolved: false
      });
    });

    it('should return null and log error when creation fails', async () => {
      const issueData = { type: 'security', file: 'test.ts' };
      const error = new Error('Database connection failed');

      mockRepository.create.mockRejectedValue(error);

      const result = await service.createIssue(issueData);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create critical issue', error);
    });
  });

  describe('getIssues', () => {
    it('should return all issues without filters', async () => {
      const mockIssues = [
        { id: '1', type: 'security', severity: 'high' },
        { id: '2', type: 'performance', severity: 'medium' }
      ];

      mockRepository.find.mockResolvedValue(mockIssues as any);

      const result = await service.getIssues();

      expect(result).toEqual(mockIssues);
      expect(mockRepository.find).toHaveBeenCalledWith(undefined);
    });

    it('should apply filters when provided', async () => {
      const filters = { type: 'security', severity: 'high', resolved: false };
      const mockFilteredIssues = [
        { id: '1', type: 'security', severity: 'high', resolved: false }
      ];

      mockRepository.find.mockResolvedValue(mockFilteredIssues as any);

      const result = await service.getIssues(filters);

      expect(result).toEqual(mockFilteredIssues);
      expect(mockRepository.find).toHaveBeenCalledWith(filters);
    });

    it('should return empty array and log error when fetch fails', async () => {
      const error = new Error('Database query failed');
      mockRepository.find.mockRejectedValue(error);

      const result = await service.getIssues();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch critical issues', error);
    });
  });

  describe('getIssueById', () => {
    it('should return issue when found', async () => {
      const issueId = 'test-id-123';
      const mockIssue = {
        id: issueId,
        type: 'security',
        severity: 'high'
      };

      mockRepository.findById.mockResolvedValue(mockIssue as any);

      const result = await service.getIssueById(issueId);

      expect(result).toEqual(mockIssue);
      expect(mockRepository.findById).toHaveBeenCalledWith(issueId);
    });

    it('should return null when issue not found', async () => {
      const issueId = 'nonexistent-id';
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getIssueById(issueId);

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith(issueId);
    });

    it('should return null and log error when fetch fails', async () => {
      const issueId = 'test-id-123';
      const error = new Error('Database error');
      mockRepository.findById.mockRejectedValue(error);

      const result = await service.getIssueById(issueId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to fetch critical issue ${issueId}`, error);
    });
  });

  describe('markAsResolved', () => {
    it('should successfully mark issue as resolved', async () => {
      const issueId = 'test-id-123';
      mockRepository.update.mockResolvedValue(true);

      const result = await service.markAsResolved(issueId);

      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalledWith(issueId, { resolved: true });
      expect(mockLogger.info).toHaveBeenCalledWith(`Marked critical issue ${issueId} as resolved`);
    });

    it('should return false when issue not found', async () => {
      const issueId = 'nonexistent-id';
      mockRepository.update.mockResolvedValue(false);

      const result = await service.markAsResolved(issueId);

      expect(result).toBe(false);
      expect(mockRepository.update).toHaveBeenCalledWith(issueId, { resolved: true });
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should return false and log error when update fails', async () => {
      const issueId = 'test-id-123';
      const error = new Error('Update failed');
      mockRepository.update.mockRejectedValue(error);

      const result = await service.markAsResolved(issueId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(`Failed to resolve critical issue ${issueId}`, error);
    });
  });

  describe('getIssueStats', () => {
    it('should return correct statistics', async () => {
      const mockIssues = [
        { id: '1', type: 'security', severity: 'high', resolved: false },
        { id: '2', type: 'security', severity: 'medium', resolved: true },
        { id: '3', type: 'performance', severity: 'high', resolved: false },
        { id: '4', type: 'technical_debt', severity: 'low', resolved: false }
      ];

      mockRepository.find.mockResolvedValue(mockIssues as any);

      const result = await service.getIssueStats();

      expect(result).toEqual({
        total: 4,
        byType: {
          security: 2,
          performance: 1,
          technical_debt: 1
        },
        bySeverity: {
          high: 2,
          medium: 1,
          low: 1
        },
        unresolved: 3
      });
    });

    it('should return empty stats when no issues exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getIssueStats();

      expect(result).toEqual({
        total: 0,
        byType: {},
        bySeverity: {},
        unresolved: 0
      });
    });

    it('should return empty stats and log error when fetch fails', async () => {
      const error = new Error('Stats query failed');
      mockRepository.find.mockRejectedValue(error);

      const result = await service.getIssueStats();

      expect(result).toEqual({
        total: 0,
        byType: {},
        bySeverity: {},
        unresolved: 0
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch issue stats', error);
    });
  });
});