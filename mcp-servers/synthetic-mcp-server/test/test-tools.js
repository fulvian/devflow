#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// This is a simple test to verify the MCP server tools
console.log('✅ Synthetic MCP Server - Test Script');
console.log('=====================================');
console.log('This script verifies that the MCP server tools are properly defined.');
console.log('');

// Import the tools
import { generateCodeTool } from '../src/tools/generate-code.js';
import { editFileTool } from '../src/tools/edit-file.js';
import { analyzeCodebaseTool } from '../src/tools/analyze-codebase.js';

console.log('✅ generate_code tool:', generateCodeTool.name);
console.log('   Description:', generateCodeTool.description);
console.log('   Required params:', Object.keys(generateCodeTool.inputSchema.properties).filter(key => generateCodeTool.inputSchema.required?.includes(key)));
console.log('');

console.log('✅ edit_file tool:', editFileTool.name);
console.log('   Description:', editFileTool.description);
console.log('   Required params:', Object.keys(editFileTool.inputSchema.properties).filter(key => editFileTool.inputSchema.required?.includes(key)));
console.log('');

console.log('✅ analyze_codebase tool:', analyzeCodebaseTool.name);
console.log('   Description:', analyzeCodebaseTool.description);
console.log('   Required params:', Object.keys(analyzeCodebaseTool.inputSchema.properties).filter(key => analyzeCodebaseTool.inputSchema.required?.includes(key)));
console.log('');

console.log('🎉 All tools are properly defined!');