#!/usr/bin/env node

/**
 * Claude Code Session Limit Detection Hook
 * Detects when Claude Code shows session limit messages and notifies the retry system
 */

const fs = require('fs');
const path = require('path');

// Check if this is a Claude Code output that contains a limit message
function checkForLimitMessage(output) {
  // Look for Claude Code limit messages
  const limitPatterns = [
    /5-hour limit reached.*resets\s*(\d+)(?::(\d+))?\s*(am|pm)/i,
    /session limit reached.*resets\s*(\d+)(?::(\d+))?\s*(am|pm)/i,
    /limit reached.*resets\s*(\d+)(?::(\d+))?\s*(am|pm)/i
  ];
  
  for (const pattern of limitPatterns) {
    const match = output.match(pattern);
    if (match) {
      return {
        detected: true,
        message: output.trim(),
        resetTime: match[0]
      };
    }
  }
  
  return { detected: false };
}

// Notify the session retry system
async function notifySessionRetry(limitMessage) {
  try {
    // Try to send via HTTP to the session retry service
    const http = require('http');
    
    const postData = JSON.stringify({ limitMessage });
    
    const options = {
      hostname: 'localhost',
      port: 8889,
      path: '/notify-limit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`[LIMIT HOOK] Notification sent to session retry system`);
    });
    
    req.on('error', (error) => {
      console.error(`[LIMIT HOOK] Failed to notify session retry system: ${error.message}`);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.error(`[LIMIT HOOK] Error notifying session retry system: ${error.message}`);
  }
}

// Main hook function
async function main() {
  // Read input from stdin (Claude Code output)
  let inputData = '';
  
  process.stdin.on('data', (chunk) => {
    inputData += chunk.toString();
  });
  
  process.stdin.on('end', async () => {
    // Check if this contains a limit message
    const limitCheck = checkForLimitMessage(inputData);
    
    if (limitCheck.detected) {
      console.log(`[LIMIT HOOK] Claude Code limit detected: ${limitCheck.message}`);
      await notifySessionRetry(limitCheck.message);
    }
    
    // Output the original data so it's not swallowed
    process.stdout.write(inputData);
  });
}

// Handle direct execution
if (require.main === module) {
  main().catch((error) => {
    console.error(`[LIMIT HOOK] Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { checkForLimitMessage, notifySessionRetry };