#!/usr/bin/env node

/**
 * Notify Limit - Simple CLI to notify the session retry system about Claude Code limits
 * Usage: node notify-limit.js "5-hour limit reached ∙ resets 3am"
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function notifyLimit(limitMessage) {
  console.log('🔔 Notifying session retry system about limit:', limitMessage);
  
  // Try to send via HTTP first (if service is running)
  try {
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
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('✅ Notification sent via HTTP');
        console.log('Response:', data);
      });
    });
    
    req.on('error', (error) => {
      console.warn('⚠️ HTTP notification failed, trying direct method:', error.message);
      notifyDirect(limitMessage);
    });
    
    req.write(postData);
    req.end();
    
  } catch (error) {
    console.warn('⚠️ HTTP notification failed, trying direct method:', error.message);
    notifyDirect(limitMessage);
  }
}

function notifyDirect(limitMessage) {
  // Try to notify directly by calling the hub
  try {
    const hubPath = path.join(__dirname, '../../services/smart-session-retry-hub.ts');
    const distHubPath = path.join(__dirname, '../../../dist/services/smart-session-retry-hub.js');
    
    let SmartSessionRetryHub;
    let hub;
    
    if (fs.existsSync(distHubPath)) {
      // Use compiled version
      SmartSessionRetryHub = require(distHubPath).default || require(distHubPath).SmartSessionRetryHub;
      hub = new SmartSessionRetryHub();
    } else if (fs.existsSync(hubPath)) {
      // Use TypeScript source version
      require('ts-node/register');
      SmartSessionRetryHub = require(hubPath).default || require(hubPath).SmartSessionRetryHub;
      hub = new SmartSessionRetryHub();
    } else {
      throw new Error('Could not find SmartSessionRetryHub');
    }
    
    hub.handleClaudeCodeLimitEvent(limitMessage)
      .then(() => {
        console.log('✅ Limit notification sent directly to hub');
      })
      .catch((error) => {
        console.error('❌ Failed to notify hub directly:', error);
        process.exit(1);
      });
      
  } catch (error) {
    console.error('❌ Failed to notify limit directly:', error);
    process.exit(1);
  }
}

// Handle CLI input
if (require.main === module) {
  const limitMessage = process.argv[2];
  
  if (!limitMessage) {
    console.error('Usage: node notify-limit.js "5-hour limit reached ∙ resets 3am"');
    console.error('Example: node notify-limit.js "5-hour limit reached ∙ resets 3am"');
    process.exit(1);
  }
  
  notifyLimit(limitMessage);
}

module.exports = { notifyLimit };