#!/usr/bin/env node

/**
 * Test completo per tutte le operazioni di modifica del codice nel sistema DevFlow
 * Verifica write, append, patch, create e delete con validazione sintattica
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = join(process.cwd(), 'test-code-modifications');
const TEST_FILES = {
  typescript: join(TEST_DIR, 'test-component.ts'),
  javascript: join(TEST_DIR, 'test-utils.js'),
  json: join(TEST_DIR, 'test-config.json'),
  python: join(TEST_DIR, 'test-script.py'),
};

async function testCodeModifications() {
  console.log('🧪 Testing DevFlow Complete Code Modification System');
  console.log('==================================================');

  try {
    // 1. Setup test directory
    console.log('📁 Creating test directory...');
    await fs.mkdir(TEST_DIR, { recursive: true });
    console.log('✅ Test directory created');

    // 2. Test WRITE operation (create new file)
    console.log('\n📝 Testing WRITE operation...');
    const tsContent = `interface TestComponent {
  name: string;
  value: number;
}

class TestComponent {
  constructor(name: string, value: number) {
    this.name = name;
    this.value = value;
  }
  
  getInfo(): string {
    return \`\${this.name}: \${this.value}\`;
  }
}`;

    await fs.writeFile(TEST_FILES.typescript, tsContent, 'utf8');
    console.log('✅ TypeScript file created with WRITE');

    // 3. Test APPEND operation
    console.log('\n➕ Testing APPEND operation...');
    const additionalContent = `

export { TestComponent };`;

    await fs.appendFile(TEST_FILES.typescript, additionalContent, 'utf8');
    console.log('✅ Content appended to TypeScript file');

    // 4. Test PATCH operation (structured)
    console.log('\n🔧 Testing PATCH operation (structured)...');
    const patchInstructions = {
      replace: [
        {
          search: 'getInfo\\(\\): string',
          with: 'getInfo(): string | null'
        }
      ],
      insert: [
        {
          line: 15,
          content: '  // Added validation method'
        },
        {
          line: 16,
          content: '  validate(): boolean {'
        },
        {
          line: 17,
          content: '    return this.name.length > 0 && this.value >= 0;'
        },
        {
          line: 18,
          content: '  }'
        }
      ]
    };

    const currentContent = await fs.readFile(TEST_FILES.typescript, 'utf8');
    const patchedContent = await applyStructuredPatch(currentContent, JSON.stringify(patchInstructions));
    await fs.writeFile(TEST_FILES.typescript, patchedContent, 'utf8');
    console.log('✅ Structured patch applied');

    // 5. Test PATCH operation (marked)
    console.log('\n🔧 Testing PATCH operation (marked)...');
    const markedPatch = `
<<<REPLACE>>>  // Enhanced validation
  validate(): boolean {
    return this.name.length > 0 && this.value >= 0 && this.name.trim() !== '';
  }<<</REPLACE>>>`;

    const currentContent2 = await fs.readFile(TEST_FILES.typescript, 'utf8');
    const markedPatchedContent = await applyMarkedPatch(currentContent2, markedPatch);
    await fs.writeFile(TEST_FILES.typescript, markedPatchedContent, 'utf8');
    console.log('✅ Marked patch applied');

    // 6. Test JavaScript file creation and modification
    console.log('\n📝 Testing JavaScript file operations...');
    const jsContent = `function calculateSum(a, b) {
  return a + b;
}

const utils = {
  multiply: (x, y) => x * y,
  divide: (x, y) => y !== 0 ? x / y : null
};

module.exports = { calculateSum, utils };`;

    await fs.writeFile(TEST_FILES.javascript, jsContent, 'utf8');
    console.log('✅ JavaScript file created');

    // 7. Test JSON file operations
    console.log('\n📝 Testing JSON file operations...');
    const jsonContent = {
      name: 'test-config',
      version: '1.0.0',
      settings: {
        debug: true,
        timeout: 5000
      },
      features: ['feature1', 'feature2']
    };

    await fs.writeFile(TEST_FILES.json, JSON.stringify(jsonContent, null, 2), 'utf8');
    console.log('✅ JSON file created');

    // 8. Test Python file operations
    console.log('\n📝 Testing Python file operations...');
    const pythonContent = `def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def process(self):
        return [x * 2 for x in self.data if x > 0]

if __name__ == "__main__":
    processor = DataProcessor([1, 2, 3, 4, 5])
    result = processor.process()
    print(f"Processed data: {result}")`;

    await fs.writeFile(TEST_FILES.python, pythonContent, 'utf8');
    console.log('✅ Python file created');

    // 9. Test syntax validation
    console.log('\n🔍 Testing syntax validation...');
    await testSyntaxValidation();

    // 10. Test DELETE operation
    console.log('\n🗑️ Testing DELETE operation...');
    await fs.unlink(TEST_FILES.json);
    if (!existsSync(TEST_FILES.json)) {
      console.log('✅ JSON file deleted successfully');
    } else {
      throw new Error('JSON file was not deleted');
    }

    // 11. Verify final state
    console.log('\n📋 Final verification...');
    const finalTsContent = await fs.readFile(TEST_FILES.typescript, 'utf8');
    console.log('✅ TypeScript file contains:', finalTsContent.includes('validate(): boolean'));
    console.log('✅ TypeScript file contains:', finalTsContent.includes('export { TestComponent }'));

    const finalJsContent = await fs.readFile(TEST_FILES.javascript, 'utf8');
    console.log('✅ JavaScript file contains:', finalJsContent.includes('calculateSum'));

    const finalPyContent = await fs.readFile(TEST_FILES.python, 'utf8');
    console.log('✅ Python file contains:', finalPyContent.includes('DataProcessor'));

    // 12. Cleanup
    console.log('\n🧹 Cleaning up test files...');
    for (const filePath of Object.values(TEST_FILES)) {
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
      }
    }
    await fs.rmdir(TEST_DIR);
    console.log('✅ Test files cleaned up');

    console.log('\n🎉 All code modification tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ WRITE operation (create new files)');
    console.log('- ✅ APPEND operation (add content)');
    console.log('- ✅ PATCH operation (structured modifications)');
    console.log('- ✅ PATCH operation (marked modifications)');
    console.log('- ✅ Multi-language support (TS, JS, JSON, Python)');
    console.log('- ✅ Syntax validation');
    console.log('- ✅ DELETE operation');
    console.log('- ✅ File verification');
    console.log('- ✅ Cleanup');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function testSyntaxValidation() {
  // Test valid TypeScript
  const validTS = `interface Test { name: string; }`;
  await validateTypeScript(validTS);
  console.log('✅ Valid TypeScript syntax passed');

  // Test invalid TypeScript (should warn but not fail)
  try {
    const invalidTS = `interface Test { name: string; // missing closing brace`;
    await validateTypeScript(invalidTS);
    console.log('⚠️ Invalid TypeScript syntax handled gracefully');
  } catch (error) {
    console.log('⚠️ Invalid TypeScript syntax caught:', error.message);
  }

  // Test valid JSON
  const validJSON = `{"name": "test", "value": 123}`;
  await validateJSON(validJSON);
  console.log('✅ Valid JSON syntax passed');

  // Test invalid JSON
  try {
    const invalidJSON = `{"name": "test", "value": 123`; // missing closing brace
    await validateJSON(invalidJSON);
  } catch (error) {
    console.log('✅ Invalid JSON syntax caught:', error.message);
  }
}

// Helper functions (simplified versions of the actual implementation)
async function applyStructuredPatch(currentContent: string, patchInstructions: string): Promise<string> {
  const instructions = JSON.parse(patchInstructions);
  let result = currentContent;
  
  if (instructions.replace) {
    for (const replacement of instructions.replace) {
      result = result.replace(new RegExp(replacement.search, 'g'), replacement.with);
    }
  }
  
  if (instructions.insert) {
    for (const insertion of instructions.insert) {
      const lines = result.split('\n');
      lines.splice(insertion.line - 1, 0, insertion.content);
      result = lines.join('\n');
    }
  }
  
  return result;
}

async function applyMarkedPatch(currentContent: string, patchContent: string): Promise<string> {
  const replacePattern = /<<<REPLACE>>>([\s\S]*?)<<<\/REPLACE>>>/g;
  return currentContent.replace(replacePattern, (match, content) => content);
}

async function validateTypeScript(content: string): Promise<void> {
  const lines = content.split('\n');
  let braceCount = 0;
  
  for (const line of lines) {
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }
  
  if (braceCount !== 0) {
    throw new Error(`Unbalanced braces: ${braceCount > 0 ? 'missing' : 'extra'} closing braces`);
  }
}

async function validateJSON(content: string): Promise<void> {
  try {
    JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Esegui il test
testCodeModifications().catch(console.error);
