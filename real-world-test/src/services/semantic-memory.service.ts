import { File } from '../types/project-structure';

export class SemanticMemoryService {
  private fileIndex: Map<string, File> = new Map();
  private semanticEmbeddings: Map<string, number[]> = new Map();

  constructor() {
    this.initializeSampleFiles();
  }

  private initializeSampleFiles(): void {
    const files: File[] = [
      {
        path: 'src/models/user.model.ts',
        content: `
          import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';
          
          @Entity('users')
          export class User extends BaseEntity {
            @PrimaryGeneratedColumn()
            id: number;
            
            @Column()
            username: string;
            
            @Column()
            email: string;
            
            @Column()
            passwordHash: string;
          }
        `,
        description: 'User entity model with authentication fields'
      },
      {
        path: 'src/controllers/auth.controller.ts',
        content: `
          import { Request, Response } from 'express';
          import { User } from '../models/user.model';
          
          export class AuthController {
            static async login(req: Request, res: Response) {
              // Implementation for user login
            }
            
            static async register(req: Request, res: Response) {
              // Implementation for user registration
            }
          }
        `,
        description: 'Authentication controller with login and registration endpoints'
      },
      {
        path: 'src/services/auth.service.ts',
        content: `
          import { User } from '../models/user.model';
          import bcrypt from 'bcrypt';
          
          export class AuthService {
            static async hashPassword(password: string): Promise<string> {
              return bcrypt.hash(password, 10);
            }
            
            static async validatePassword(plain: string, hash: string): Promise<boolean> {
              return bcrypt.compare(plain, hash);
            }
          }
        `,
        description: 'Authentication service with password hashing utilities'
      },
      {
        path: 'src/components/LoginForm.tsx',
        content: `
          import React, { useState } from 'react';
          
          interface LoginFormProps {
            onLogin: (credentials: { username: string; password: string }) => void;
          }
          
          export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
            const [username, setUsername] = useState('');
            const [password, setPassword] = useState('');
            
            const handleSubmit = (e: React.FormEvent) => {
              e.preventDefault();
              onLogin({ username, password });
            };
            
            return (
              <form onSubmit={handleSubmit}>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Username" 
                />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Password" 
                />
                <button type="submit">Login</button>
              </form>
            );
          };
        `,
        description: 'React login form component with username and password fields'
      }
    ];

    files.forEach(file => {
      this.fileIndex.set(file.path, file);
      // In a real implementation, we would generate embeddings here
      this.semanticEmbeddings.set(file.path, this.generateDummyEmbedding());
    });
  }

  private generateDummyEmbedding(): number[] {
    // Generate a dummy 128-dimensional embedding
    return Array.from({ length: 128 }, () => Math.random());
  }

  getFile(path: string): File | undefined {
    return this.fileIndex.get(path);
  }

  searchFiles(query: string): File[] {
    // In a real implementation, this would use semantic similarity
    // For now, we'll do a simple content-based search
    const results: File[] = [];
    
    for (const file of this.fileIndex.values()) {
      if (
        file.path.includes(query) || 
        file.content.includes(query) || 
        file.description.includes(query)
      ) {
        results.push(file);
      }
    }
    
    return results;
  }

  getRelatedFiles(filePath: string): File[] {
    // In a real implementation, this would find semantically similar files
    // For now, we'll return files in the same directory
    const targetDir = filePath.substring(0, filePath.lastIndexOf('/'));
    const related: File[] = [];
    
    for (const file of this.fileIndex.values()) {
      const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
      if (fileDir === targetDir && file.path !== filePath) {
        related.push(file);
      }
    }
    
    return related;
  }

  getFileEmbedding(path: string): number[] | undefined {
    return this.semanticEmbeddings.get(path);
  }
}