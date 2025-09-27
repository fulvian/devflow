# Synthetic File Operations - Usage Guide

**For Developers & Agents**: How to use the new Synthetic MCP file operation tools

## Quick Start

The enhanced Synthetic MCP server now provides 6 powerful file operation tools that enable direct project file manipulation. All operations are secure, audited, and include automatic backup protection.

## Available Tools

### 1. `synthetic_file_write` ✏️
**Purpose**: Write or overwrite file content  
**Use Cases**: Update existing files, modify configurations, apply code changes

```typescript
// Example: Update a configuration file
{
  "tool": "synthetic_file_write",
  "args": {
    "file_path": "config/database.json",
    "content": "{\n  \"host\": \"localhost\",\n  \"port\": 5432,\n  \"database\": \"devflow_prod\"\n}",
    "backup": true  // Creates backup before overwriting
  }
}
```

**Response Format**:
```markdown
# ✏️ FILE WRITE OPERATION

**File**: `config/database.json`
**Status**: SUCCESS
**Message**: File overwritten
**Backup Created**: `config/database.json.backup-2025-09-11T21-38-47-820Z`
**Content Size**: 87 characters
```

### 2. `synthetic_file_read` 📖  
**Purpose**: Read file content safely  
**Use Cases**: Analyze existing code, read configurations, understand project structure

```typescript
// Example: Read a component for analysis
{
  "tool": "synthetic_file_read", 
  "args": {
    "file_path": "src/components/Button.tsx"
  }
}
```

**Response Format**:
```markdown
# 📖 FILE READ OPERATION

**File**: `src/components/Button.tsx`
**Size**: 1,234 characters
**Status**: SUCCESS

## Content:

```
import React from 'react';
// ... full file content
```

### 3. `synthetic_file_create` 📁
**Purpose**: Create new files  
**Use Cases**: Generate new components, create test files, add documentation

```typescript
// Example: Create a new React component
{
  "tool": "synthetic_file_create",
  "args": {
    "file_path": "src/components/Modal.tsx",
    "content": "import React, { useState } from 'react';\n\ninterface ModalProps {\n  isOpen: boolean;\n  onClose: () => void;\n  children: React.ReactNode;\n}\n\nexport const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {\n  if (!isOpen) return null;\n\n  return (\n    <div className=\"modal-overlay\" onClick={onClose}>\n      <div className=\"modal-content\" onClick={(e) => e.stopPropagation()}>\n        <button className=\"modal-close\" onClick={onClose}>×</button>\n        {children}\n      </div>\n    </div>\n  );\n};",
    "backup": true
  }
}
```

### 4. `synthetic_file_delete` 🗑️
**Purpose**: Safely delete files with backup  
**Use Cases**: Remove obsolete files, clean up temporary files, refactor unused code

```typescript
// Example: Delete an obsolete component
{
  "tool": "synthetic_file_delete",
  "args": {
    "file_path": "src/components/OldButton.tsx",
    "backup": true  // Always creates backup before deletion
  }
}
```

**Note**: Requires `SYNTHETIC_DELETE_ENABLED=true` in environment configuration.

### 5. `synthetic_batch_operations` ⚡
**Purpose**: Execute multiple file operations atomically  
**Use Cases**: Refactoring across multiple files, creating complete features, project reorganization

```typescript
// Example: Create a complete feature with multiple files
{
  "tool": "synthetic_batch_operations",
  "args": {
    "task_id": "FEATURE-USER-PROFILE-001",
    "description": "Create user profile feature with component, styles, and tests",
    "operations": [
      {
        "type": "create",
        "path": "src/components/UserProfile.tsx",
        "content": "// React component code...",
        "backup": true
      },
      {
        "type": "create", 
        "path": "src/components/UserProfile.module.css",
        "content": "/* CSS styles... */",
        "backup": true
      },
      {
        "type": "create",
        "path": "src/components/__tests__/UserProfile.test.tsx", 
        "content": "// Jest test code...",
        "backup": true
      },
      {
        "type": "write",
        "path": "src/components/index.ts",
        "content": "// Updated exports including UserProfile...",
        "backup": true
      }
    ]
  }
}
```

**Response Format**:
```markdown
# ⚡ BATCH FILE OPERATIONS

**Task ID**: FEATURE-USER-PROFILE-001
**Operations**: 4
**Description**: Create user profile feature with component, styles, and tests

## Results:

✅ **create** `src/components/UserProfile.tsx` - File created successfully
✅ **create** `src/components/UserProfile.module.css` - File created successfully  
✅ **create** `src/components/__tests__/UserProfile.test.tsx` - File created successfully
✅ **write** `src/components/index.ts` - File overwritten
   📋 Backup: `src/components/index.ts.backup-2025-09-11T21-45-32-156Z`
```

### 6. `synthetic_code_to_file` 💾
**Purpose**: Generate code using Synthetic AI and write directly to file  
**Use Cases**: AI-assisted code generation, automated boilerplate creation, intelligent refactoring

```typescript
// Example: Generate a complete API endpoint
{
  "tool": "synthetic_code_to_file",
  "args": {
    "task_id": "API-USERS-ENDPOINT-001",
    "file_path": "src/api/users.ts",
    "objective": "Create a complete CRUD API endpoint for user management",
    "language": "typescript",
    "requirements": [
      "Express.js framework",
      "TypeScript strict mode", 
      "Proper error handling",
      "Input validation with Zod",
      "Database integration with Prisma"
    ],
    "context": "Existing API structure follows patterns in src/api/posts.ts",
    "backup": true
  }
}
```

**Response Format**:
```markdown
# 💾 CODE GENERATION TO FILE

**Task ID**: API-USERS-ENDPOINT-001
**File**: `src/api/users.ts`
**Language**: typescript
**Objective**: Create a complete CRUD API endpoint for user management

## Write Result:
**Status**: SUCCESS
**Message**: File created successfully
**Code Size**: 2,847 characters
**Backup Created**: `src/api/users.ts.backup-2025-09-11T21-48-15-432Z`

## Generated Code Preview:
```typescript
import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
// ... (truncated for brevity)
```

## Best Practices

### 1. Security Considerations
- ✅ **Always enable backups**: Set `backup: true` for destructive operations
- ✅ **Use appropriate paths**: Only modify files within allowed project directories
- ✅ **Validate file extensions**: Stick to supported file types (`.ts`, `.js`, `.json`, `.md`, etc.)

### 2. Error Handling
- All operations return structured status information
- Check response status before assuming success
- Review error messages for security violations or path issues

### 3. Batch Operations
- Use `synthetic_batch_operations` for related file changes
- Keep batch sizes reasonable (< 10 operations per batch)
- Use descriptive task IDs for tracking and debugging

### 4. Code Generation
- Provide detailed requirements for better AI output
- Include context about existing code patterns
- Review generated code before deploying to production

### 5. Monitoring & Auditing
- All operations are logged with JSON audit trails
- Use request IDs for tracking specific operations
- Monitor backup creation for important files

## Configuration

### Environment Variables
```bash
# Enable autonomous file operations
AUTONOMOUS_FILE_OPERATIONS=true

# Enable backup creation (recommended)
CREATE_BACKUPS=true

# Enable delete operations (use with caution)
SYNTHETIC_DELETE_ENABLED=true

# Set project root for path validation
DEVFLOW_PROJECT_ROOT=/path/to/your/project
```

### Allowed File Extensions
The system supports these file types by default:
- **Code**: `.ts`, `.js`, `.tsx`, `.jsx`, `.py`
- **Config**: `.json`, `.yml`, `.yaml`, `.env`
- **Styles**: `.css`, `.scss`
- **Markup**: `.html`, `.md`
- **Scripts**: `.sh`, `.sql`
- **Text**: `.txt`

## Troubleshooting

### Common Issues

**"Path not allowed" Error**
- Ensure file path is within project root
- Check that target directory is in allowed paths list

**"File extension not allowed" Error**  
- Use supported file extensions only
- Contact admin to add new extensions if needed

**"Delete operations disabled" Error**
- Set `SYNTHETIC_DELETE_ENABLED=true` in environment
- Consider if deletion is really necessary vs backup

**"Backup creation failed" Error**
- Check disk space availability
- Verify write permissions on target directory

### Debug Mode
Enable verbose logging by setting:
```bash
DEVFLOW_VERBOSE=true
```

## Real-World Examples

### Example 1: Refactor Component Structure
```typescript
// Move and rename component files
{
  "tool": "synthetic_batch_operations",
  "args": {
    "task_id": "REFACTOR-COMPONENTS-001",
    "description": "Reorganize Button components into dedicated directory",
    "operations": [
      {
        "type": "mkdir",
        "path": "src/components/Button",
        "recursive": true
      },
      {
        "type": "move", 
        "path": "src/components/Button.tsx",
        "targetPath": "src/components/Button/Button.tsx"
      },
      {
        "type": "create",
        "path": "src/components/Button/index.ts",
        "content": "export { Button } from './Button';\nexport type { ButtonProps } from './Button';"
      }
    ]
  }
}
```

### Example 2: Generate Test Suite
```typescript
// Create comprehensive test coverage
{
  "tool": "synthetic_code_to_file",
  "args": {
    "task_id": "TESTS-USER-SERVICE-001", 
    "file_path": "src/services/__tests__/userService.test.ts",
    "objective": "Create comprehensive unit tests for userService module",
    "language": "typescript",
    "requirements": [
      "Jest testing framework",
      "Mock database calls",
      "Test all CRUD operations", 
      "Error case coverage",
      "TypeScript strict mode"
    ],
    "context": "Testing patterns follow src/services/__tests__/postService.test.ts"
  }
}
```

### Example 3: Update Multiple Configuration Files
```typescript
// Update configurations across environment
{
  "tool": "synthetic_batch_operations",
  "args": {
    "task_id": "CONFIG-UPDATE-API-VERSION-001",
    "description": "Update API version across all configuration files",
    "operations": [
      {
        "type": "write",
        "path": "package.json", 
        "content": "{ \"version\": \"2.1.0\", ... }"
      },
      {
        "type": "write",
        "path": "config/api.json",
        "content": "{ \"version\": \"v2.1\", \"endpoint\": \"/api/v2.1\" }"
      },
      {
        "type": "write", 
        "path": "docs/api-version.md",
        "content": "# API Version 2.1.0\\n\\nRelease notes..."
      }
    ]
  }
}
```

## Conclusion

The Synthetic file operations tools provide powerful, secure, and audited file system access for autonomous development tasks. Use them responsibly with proper backups and monitoring to unlock the full potential of AI-assisted development.

For technical support or feature requests, refer to the project documentation or contact the DevFlow development team.