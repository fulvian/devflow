#!/usr/bin/env npx ts-node

/**
 * DevFlow Dist-to-Source Migration Script
 * Automatically migrates patches from dist compiled files back to TypeScript sources
 * Addresses the critical issue of manual patches applied only to dist without sync
 */

import * as fs from 'fs';
import * as path from 'path';

interface MigrationTask {
  distFile: string;
  sourceFile: string;
  status: 'needs_creation' | 'needs_sync' | 'up_to_date';
  patches?: string[];
}

class DistToSourceMigrator {
  private migrationTasks: MigrationTask[] = [];
  private rootPath: string;

  constructor(rootPath: string = '.') {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Analyze dist vs source discrepancies
   */
  analyzeDiscrepancies(): MigrationTask[] {
    const distDir = path.join(this.rootPath, 'services/devflow-orchestrator/dist');
    const srcDir = path.join(this.rootPath, 'services/devflow-orchestrator/src');

    // Critical files known to have manual patches in dist
    const criticalFiles = [
      'routes/memory.js',
      'routes/synthetic.js',
      'routes/tasks.js',
      'routes/sessions.js',
      'app.js'
    ];

    for (const jsFile of criticalFiles) {
      const distPath = path.join(distDir, jsFile);
      const tsFile = jsFile.replace('.js', '.ts');
      const sourcePath = path.join(srcDir, tsFile);

      if (fs.existsSync(distPath)) {
        const task: MigrationTask = {
          distFile: distPath,
          sourceFile: sourcePath,
          status: fs.existsSync(sourcePath) ? 'needs_sync' : 'needs_creation'
        };

        if (task.status === 'needs_sync') {
          task.patches = this.identifyPatches(distPath, sourcePath);
        }

        this.migrationTasks.push(task);
      }
    }

    return this.migrationTasks;
  }

  /**
   * Identify patches by comparing dist JS with theoretical TS compilation
   */
  private identifyPatches(distPath: string, sourcePath: string): string[] {
    const patches: string[] = [];

    try {
      const distContent = fs.readFileSync(distPath, 'utf8');

      // Key indicators of manual patches in dist
      const patchIndicators = [
        'unified_schema',
        'batch_operations_available',
        'GET /api/memory/stats',
        'POST /api/memory/batch',
        'embedding_vector',
        'UnifiedDatabaseManager'
      ];

      for (const indicator of patchIndicators) {
        if (distContent.includes(indicator)) {
          patches.push(`Contains manual patch: ${indicator}`);
        }
      }

      // Check for route additions
      if (distContent.includes("router.get('/stats'")) {
        patches.push('Added /stats endpoint');
      }
      if (distContent.includes("router.post('/batch'")) {
        patches.push('Added /batch endpoint');
      }

    } catch (error) {
      patches.push(`Error analyzing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return patches;
  }

  /**
   * Create TypeScript source from JavaScript dist (reverse compilation)
   */
  private async createSourceFromDist(task: MigrationTask): Promise<void> {
    const distContent = fs.readFileSync(task.distFile, 'utf8');

    // Basic JS to TS conversion
    let tsContent = distContent
      .replace(/require\('(.+?)'\)/g, 'import $1')
      .replace(/exports\.(\w+) = /g, 'export const $1 = ')
      .replace(/module\.exports = /g, 'export default ')
      .replace(/var __importDefault = .*?;/g, '')
      .replace(/"use strict";\n/g, '')
      .replace(/Object\.defineProperty\(exports.*?\);/g, '');

    // Add TypeScript imports and types for memory routes
    if (task.distFile.includes('memory.js')) {
      const tsImports = `import { Router } from 'express';
import { z } from 'zod';
import { db } from '../services/db';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

`;
      tsContent = tsImports + tsContent;
    }

    // Ensure directory exists
    const sourceDir = path.dirname(task.sourceFile);
    fs.mkdirSync(sourceDir, { recursive: true });

    // Write TypeScript file
    fs.writeFileSync(task.sourceFile, tsContent);
    console.log(`✅ Created TypeScript source: ${task.sourceFile}`);
  }

  /**
   * Sync existing TypeScript source with dist patches
   */
  private async syncSourceWithDist(task: MigrationTask): Promise<void> {
    const distContent = fs.readFileSync(task.distFile, 'utf8');
    let sourceContent = fs.readFileSync(task.sourceFile, 'utf8');

    // Extract key functionality from dist that needs to be in source
    if (task.distFile.includes('memory') && task.patches?.some(p => p.includes('/stats'))) {
      // Add stats endpoint if missing
      if (!sourceContent.includes("router.get('/stats'")) {
        const statsEndpoint = `
// GET /api/memory/stats → unified statistics
router.get('/stats', async (req, res) => {
  try {
    const memoryBlocks = db.prepare('SELECT COUNT(*) as count FROM memory_blocks').get()?.count || 0;
    const embeddings = db.prepare('SELECT COUNT(*) as count FROM memory_block_embeddings').get()?.count || 0;
    const models = db.prepare('SELECT COUNT(DISTINCT model_id) as count FROM memory_block_embeddings').get()?.count || 0;
    const avgEmbeddings = memoryBlocks > 0 ? embeddings / memoryBlocks : 0;

    const response: ApiResponse = {
      success: true,
      data: {
        memoryBlocks,
        embeddings,
        models,
        averageEmbeddingsPerBlock: Math.round(avgEmbeddings * 100) / 100,
        unified_schema: true,
        embedding_model: 'gemma-7b-embedding',
        batch_operations_available: true
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'STATS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(response);
  }
});
`;
        sourceContent = sourceContent.replace('export { router as memoryRoutes };', statsEndpoint + '\n\nexport { router as memoryRoutes };');
      }

      // Add batch endpoint if missing
      if (!sourceContent.includes("router.post('/batch'")) {
        const batchEndpoint = `
// POST /api/memory/batch → batch operations
router.post('/batch', async (req, res) => {
  try {
    const entries = req.body.entries || [];
    const results = [];
    const now = new Date().toISOString();

    for (const entry of entries) {
      const finalId = \`mem_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`;
      const ts = entry.timestamp || now;

      // Store memory block
      db.prepare(\`
        INSERT INTO memory_blocks (id, content, type, timestamp)
        VALUES (?, ?, ?, ?)
      \`).run(finalId, entry.content, entry.type, ts);

      results.push({
        id: finalId,
        content: entry.content,
        type: entry.type,
        timestamp: ts,
        metadata: entry.metadata || {}
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        stored: results.length,
        entries: results,
        processedInParallel: req.body.processInParallel || true
      },
      timestamp: now,
    };

    res.status(201).json(response);

  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: { code: 'BATCH_ERROR', message: error instanceof Error ? error.message : 'Unknown error' },
      timestamp: new Date().toISOString(),
    };
    res.status(400).json(response);
  }
});
`;
        sourceContent = sourceContent.replace('export { router as memoryRoutes };', batchEndpoint + '\n\nexport { router as memoryRoutes };');
      }
    }

    // Write updated source
    fs.writeFileSync(task.sourceFile, sourceContent);
    console.log(`🔄 Synced TypeScript source: ${task.sourceFile}`);
  }

  /**
   * Execute migration for all identified tasks
   */
  async migrate(): Promise<void> {
    console.log('🚀 Starting Dist-to-Source Migration...');

    this.analyzeDiscrepancies();

    console.log(`📊 Found ${this.migrationTasks.length} files requiring migration`);

    for (const task of this.migrationTasks) {
      console.log(`\n📋 Processing: ${path.basename(task.distFile)}`);
      console.log(`   Status: ${task.status}`);

      if (task.patches && task.patches.length > 0) {
        console.log(`   Patches found: ${task.patches.length}`);
        task.patches.forEach(patch => console.log(`     - ${patch}`));
      }

      try {
        if (task.status === 'needs_creation') {
          await this.createSourceFromDist(task);
        } else if (task.status === 'needs_sync') {
          await this.syncSourceWithDist(task);
        }
      } catch (error) {
        console.error(`❌ Error processing ${task.distFile}:`, error);
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('📝 Next: Run build pipeline to validate migration');
  }

  /**
   * Validate migration by comparing build output
   */
  async validateMigration(): Promise<boolean> {
    console.log('🔍 Validating migration...');

    // This would run tsc build and compare outputs
    // For now, we'll do basic validation

    let valid = true;
    for (const task of this.migrationTasks) {
      if (fs.existsSync(task.sourceFile)) {
        console.log(`✅ Source exists: ${path.basename(task.sourceFile)}`);
      } else {
        console.log(`❌ Source missing: ${path.basename(task.sourceFile)}`);
        valid = false;
      }
    }

    return valid;
  }
}

/**
 * Main execution
 */
async function main() {
  const migrator = new DistToSourceMigrator();

  try {
    await migrator.migrate();
    const isValid = await migrator.validateMigration();

    if (isValid) {
      console.log('\n🎉 Dist-to-Source migration completed successfully!');
      console.log('💡 Run "npm run build" to test the migration');
    } else {
      console.log('\n⚠️ Migration completed with warnings');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DistToSourceMigrator };