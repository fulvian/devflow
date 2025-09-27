/**
 * Test Code Examples - Vulnerable Code
 * Used in comprehensive verification tests to demonstrate security analysis
 */

// Example 1: SQL Injection Vulnerability
export class UserService {
  async getUserById(userId: string): Promise<any> {
    // VULNERABILITY: Direct string concatenation leads to SQL injection
    const query = `SELECT * FROM users WHERE id = '${userId}'`;
    return this.database.query(query);
  }

  async updateUser(userId: string, data: any): Promise<void> {
    // VULNERABILITY: Unvalidated input
    const query = `UPDATE users SET name = '${data.name}' WHERE id = ${userId}`;
    await this.database.execute(query);
  }

  private database: any;
}

// Example 2: Buffer Overflow Potential
export function processBuffer(input: string): string {
  // VULNERABILITY: No bounds checking
  const buffer = new Array(100);
  for (let i = 0; i < input.length; i++) {
    buffer[i] = input.charAt(i);
  }
  return buffer.join('');
}

// Example 3: XSS Vulnerability
export function renderUserContent(content: string): string {
  // VULNERABILITY: Unescaped HTML content
  return `<div class="user-content">${content}</div>`;
}

// Example 4: Insecure Random Number Generation
export function generateToken(): string {
  // VULNERABILITY: Weak randomness
  return Math.random().toString(36).substring(2);
}

// Example 5: Path Traversal Vulnerability
export function readFile(filename: string): string {
  // VULNERABILITY: No path validation
  const fs = require('fs');
  return fs.readFileSync(`./uploads/${filename}`, 'utf8');
}