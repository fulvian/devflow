import * as stdio from '../mcp-servers/synthetic/node_modules/@modelcontextprotocol/sdk/dist/shared/stdio.js';
console.log('has JSONRPCMessageSchema?', typeof stdio.deserializeMessage === 'function');
