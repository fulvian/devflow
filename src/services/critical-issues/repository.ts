import { Pool, QueryResult } from 'pg';
import { CriticalIssue, CreateCriticalIssueInput, UpdateCriticalIssueInput } from './types';

export class CriticalIssuesRepository {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async create(issue: CreateCriticalIssueInput): Promise<CriticalIssue> {
    const query = `
      INSERT INTO critical_issues (
        title, description, severity, category, 
        project_context, technical_debt_score, pattern_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      issue.title,
      issue.description,
      issue.severity,
      issue.category,
      issue.projectContext ? JSON.stringify(issue.projectContext) : null,
      issue.technicalDebtScore,
      issue.patternHash
    ];
    
    const result: QueryResult = await this.db.query(query, values);
    return this.mapRowToCriticalIssue(result.rows[0]);
  }

  async findById(id: string): Promise<CriticalIssue | null> {
    const query = 'SELECT * FROM critical_issues WHERE id = $1';
    const result: QueryResult = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCriticalIssue(result.rows[0]);
  }

  async findAll(filters?: {
    severity?: string;
    status?: string;
    category?: string;
    projectId?: string;
  }): Promise<CriticalIssue[]> {
    let query = 'SELECT * FROM critical_issues WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;
    
    if (filters?.severity) {
      paramCount++;
      query += ` AND severity = $${paramCount}`;
      values.push(filters.severity);
    }
    
    if (filters?.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(filters.status);
    }
    
    if (filters?.category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      values.push(filters.category);
    }
    
    if (filters?.projectId) {
      paramCount++;
      query += ` AND project_context->>'id' = $${paramCount}`;
      values.push(filters.projectId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result: QueryResult = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToCriticalIssue(row));
  }

  async update(id: string, updates: UpdateCriticalIssueInput): Promise<CriticalIssue | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount}`);
      values.push(updates.title);
      paramCount++;
    }
    
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(updates.description);
      paramCount++;
    }
    
    if (updates.severity !== undefined) {
      fields.push(`severity = $${paramCount}`);
      values.push(updates.severity);
      paramCount++;
    }
    
    if (updates.category !== undefined) {
      fields.push(`category = $${paramCount}`);
      values.push(updates.category);
      paramCount++;
    }
    
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push(updates.status);
      paramCount++;
    }
    
    if (updates.projectContext !== undefined) {
      fields.push(`project_context = $${paramCount}`);
      values.push(JSON.stringify(updates.projectContext));
      paramCount++;
    }
    
    if (updates.technicalDebtScore !== undefined) {
      fields.push(`technical_debt_score = $${paramCount}`);
      values.push(updates.technicalDebtScore);
      paramCount++;
    }
    
    if (updates.patternHash !== undefined) {
      fields.push(`pattern_hash = $${paramCount}`);
      values.push(updates.patternHash);
      paramCount++;
    }
    
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(id);
    const query = `
      UPDATE critical_issues
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result: QueryResult = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCriticalIssue(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM critical_issues WHERE id = $1';
    const result: QueryResult = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }

  private mapRowToCriticalIssue(row: any): CriticalIssue {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      category: row.category,
      status: row.status,
      projectContext: row.project_context ? JSON.parse(row.project_context) : undefined,
      technicalDebtScore: row.technical_debt_score,
      patternHash: row.pattern_hash,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}