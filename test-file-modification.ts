// Test file created by Enhanced MCP Server
// This demonstrates direct file creation without Claude token usage

interface TestInterface {
  id: string;
  name: string;
  createdAt: Date;
}

export class TestClass {
  constructor(private data: TestInterface) {}
  
  getName(): string {
    return this.data.name;
  }
}

// File created with ZERO Claude tokens! ✅
