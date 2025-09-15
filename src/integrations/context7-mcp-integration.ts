import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export class Context7MCPIntegration {
  private serverProcess: any;
  private readonly serverPort: number = 3001;
  private readonly semanticMemoryEndpoint: string = 'http://localhost:3000/semantic-memory';
  private isServerRunning: boolean = false;
  private readonly installCommand: string = 'claude mcp add context7 -- npx -y @upstash/context7-mcp@latest';

  constructor() {
    this.validateEnvironment();
  }

  /**
   * Install Context7 MCP server
   */
  public async install(): Promise<void> {
    try {
      console.log('🔧 Installing Context7 MCP server...');
      
      // Check if already installed
      if (await this.isInstalled()) {
        console.log('✅ Context7 MCP server already installed');
        return;
      }

      // Execute installation command
      execSync(this.installCommand, { 
        stdio: 'inherit',
        timeout: 60000 // 1 minute timeout
      });

      // Verify installation
      if (await this.isInstalled()) {
        console.log('✅ Context7 MCP server installed successfully');
      } else {
        throw new Error('Installation verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to install Context7 MCP server:', error);
      throw new Error(`Context7 installation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if Context7 MCP server is installed
   */
  public async isInstalled(): Promise<boolean> {
    try {
      // Check if npx can find the package
      execSync('npx @upstash/context7-mcp --version', { 
        stdio: 'pipe',
        timeout: 5000 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start Context7 MCP server
   */
  public async startServer(): Promise<void> {
    try {
      if (this.isServerRunning) {
        console.log('✅ Context7 MCP server already running');
        return;
      }

      console.log('🚀 Starting Context7 MCP server...');

      // Start the server process
      this.serverProcess = spawn('npx', ['@upstash/context7-mcp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: this.serverPort.toString()
        }
      });

      // Handle server output
      this.serverProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`Context7 MCP: ${data.toString()}`);
      });

      this.serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`Context7 MCP Error: ${data.toString()}`);
      });

      this.serverProcess.on('exit', (code: number) => {
        console.log(`Context7 MCP server exited with code ${code}`);
        this.isServerRunning = false;
      });

      // Wait for server to be ready
      await this.waitForServerReady();
      this.isServerRunning = true;
      console.log('✅ Context7 MCP server started successfully');

    } catch (error) {
      console.error('❌ Failed to start Context7 MCP server:', error);
      throw new Error(`Context7 server startup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop Context7 MCP server
   */
  public async stopServer(): Promise<void> {
    try {
      if (!this.isServerRunning || !this.serverProcess) {
        console.log('✅ Context7 MCP server already stopped');
        return;
      }

      console.log('🛑 Stopping Context7 MCP server...');
      
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.serverProcess) {
            this.serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.isServerRunning = false;
      console.log('✅ Context7 MCP server stopped successfully');

    } catch (error) {
      console.error('❌ Failed to stop Context7 MCP server:', error);
      throw new Error(`Context7 server shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get documentation for a library using Context7
   */
  public async getDocumentation(libraryName: string, version?: string): Promise<string> {
    try {
      if (!this.isServerRunning) {
        await this.startServer();
      }

      console.log(`📚 Fetching documentation for ${libraryName}${version ? `@${version}` : ''}...`);

      const response = await fetch(`http://localhost:${this.serverPort}/docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          library: libraryName,
          version: version,
          format: 'markdown'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const documentation = await response.text();
      console.log(`✅ Retrieved ${documentation.length} characters of documentation`);
      
      return documentation;

    } catch (error) {
      console.error(`❌ Failed to get documentation for ${libraryName}:`, error);
      throw new Error(`Documentation retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Inject documentation context into semantic memory
   */
  public async injectDocumentationContext(libraryName: string, context: string): Promise<void> {
    try {
      console.log(`🧠 Injecting documentation context for ${libraryName} into semantic memory...`);

      const response = await fetch(`${this.semanticMemoryEndpoint}/inject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'context7',
          library: libraryName,
          documentation: context,
          timestamp: new Date().toISOString(),
          type: 'library_documentation'
        })
      });

      if (!response.ok) {
        throw new Error(`Semantic memory injection failed: HTTP ${response.status}`);
      }

      console.log(`✅ Documentation context injected for ${libraryName}`);

    } catch (error) {
      console.error(`❌ Failed to inject documentation context for ${libraryName}:`, error);
      throw new Error(`Context injection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Use Context7 with "use context7" command simulation
   */
  public async useContext7(libraryNames: string[]): Promise<{ [key: string]: string }> {
    try {
      console.log(`🎯 Using Context7 for libraries: ${libraryNames.join(', ')}`);
      
      const documentationMap: { [key: string]: string } = {};

      for (const library of libraryNames) {
        try {
          const docs = await this.getDocumentation(library);
          documentationMap[library] = docs;
          
          // Inject into semantic memory for DevFlow integration
          await this.injectDocumentationContext(library, docs);
          
        } catch (error) {
          console.warn(`⚠️ Failed to get documentation for ${library}, skipping...`);
          documentationMap[library] = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      console.log(`✅ Context7 processing completed for ${libraryNames.length} libraries`);
      return documentationMap;

    } catch (error) {
      console.error('❌ Context7 usage failed:', error);
      throw new Error(`Context7 usage failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Health check for Context7 MCP server
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isServerRunning) {
        return false;
      }

      const response = await fetch(`http://localhost:${this.serverPort}/health`, {
        method: 'GET',
        timeout: 5000
      });

      return response.ok;

    } catch (error) {
      console.warn('Context7 health check failed:', error);
      return false;
    }
  }

  /**
   * Get server status
   */
  public getStatus(): { running: boolean; port: number; installed: boolean } {
    return {
      running: this.isServerRunning,
      port: this.serverPort,
      installed: this.isInstalled() as any // Will be resolved async
    };
  }

  /**
   * Wait for server to be ready
   */
  private async waitForServerReady(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:${this.serverPort}/health`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Context7 MCP server failed to start within timeout period');
  }

  /**
   * Validate environment
   */
  private validateEnvironment(): void {
    try {
      // Check if Node.js is available
      execSync('node --version', { stdio: 'pipe' });
      
      // Check if npm is available
      execSync('npm --version', { stdio: 'pipe' });
      
      // Check if npx is available
      execSync('npx --version', { stdio: 'pipe' });

    } catch (error) {
      throw new Error('Required environment not available. Node.js, npm, and npx are required for Context7 MCP integration.');
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      await this.stopServer();
      console.log('✅ Context7 MCP integration cleaned up');
    } catch (error) {
      console.error('❌ Context7 cleanup failed:', error);
    }
  }
}

// Singleton instance for global access
export const context7Integration = new Context7MCPIntegration();