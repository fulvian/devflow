#!/usr/bin/env node

/**
 * Synthetic Rate Limit Monitor
 * 
 * Monitors when Synthetic API rate limits reset
 * and tests different models to identify the issue
 */

import https from 'https';

const SYNTHETIC_API_KEY = 'syn_4f04a1a3108cfbb64ac973367542d361';
const API_URL = 'https://api.synthetic.new/v1/chat/completions';

class SyntheticRateMonitor {
  constructor() {
    this.testResults = [];
    this.startTime = new Date();
  }

  async testModel(modelName) {
    const payload = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: "Test message - please respond with 'OK'"
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    };

    return new Promise((resolve) => {
      const url = new URL(API_URL);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
          'User-Agent': 'DevFlow-RateMonitor/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const result = {
            model: modelName,
            status: res.statusCode,
            timestamp: new Date().toISOString(),
            success: res.statusCode === 200,
            response: data,
            error: res.statusCode !== 200 ? data : null
          };
          
          resolve(result);
        });
      });

      req.on('error', (error) => {
        resolve({
          model: modelName,
          status: 0,
          timestamp: new Date().toISOString(),
          success: false,
          response: '',
          error: error.message
        });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async runTest() {
    console.log('🔍 Testing Synthetic API Rate Limits...\n');
    
    const models = [
      'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
      'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
      'hf:meta-llama/Llama-3.1-8B-Instruct',
      'hf:deepseek-ai/DeepSeek-V3'
    ];

    for (const model of models) {
      console.log(`Testing ${model}...`);
      const result = await this.testModel(model);
      this.testResults.push(result);
      
      if (result.success) {
        console.log(`✅ ${model} - SUCCESS`);
        console.log(`   Response: ${result.response.substring(0, 100)}...`);
      } else {
        console.log(`❌ ${model} - FAILED`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
      
      // Wait 2 seconds between tests to avoid rapid requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.generateReport();
  }

  generateReport() {
    console.log('📊 RATE LIMIT ANALYSIS REPORT\n');
    console.log('=' .repeat(50));
    
    const successCount = this.testResults.filter(r => r.success).length;
    const failureCount = this.testResults.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Success Rate: ${((successCount / this.testResults.length) * 100).toFixed(1)}%`);
    console.log('');
    
    if (failureCount > 0) {
      console.log('❌ FAILED MODELS:');
      this.testResults
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`   - ${result.model}`);
          console.log(`     Status: ${result.status}`);
          console.log(`     Error: ${result.error}`);
          console.log('');
        });
    }
    
    if (successCount > 0) {
      console.log('✅ WORKING MODELS:');
      this.testResults
        .filter(r => r.success)
        .forEach(result => {
          console.log(`   - ${result.model}`);
        });
      console.log('');
    }
    
    // Analyze error patterns
    const error429 = this.testResults.filter(r => r.status === 429);
    const error402 = this.testResults.filter(r => r.status === 402);
    
    if (error429.length > 0) {
      console.log('🚨 RATE LIMIT ANALYSIS:');
      console.log(`   - ${error429.length} models hit rate limit (429)`);
      console.log('   - This suggests a global rate limit on your account');
      console.log('   - May be daily/hourly limit that resets periodically');
      console.log('');
    }
    
    if (error402.length > 0) {
      console.log('💳 BILLING ANALYSIS:');
      console.log(`   - ${error402.length} models hit billing limit (402)`);
      console.log('   - This suggests insufficient credits or plan limits');
      console.log('');
    }
    
    console.log('💡 RECOMMENDATIONS:');
    if (error429.length > 0) {
      console.log('   1. Wait 1-2 hours and test again (rate limits often reset hourly)');
      console.log('   2. Check Synthetic.new dashboard for usage statistics');
      console.log('   3. Contact Synthetic support if limits persist');
    } else if (error402.length > 0) {
      console.log('   1. Check your Synthetic.new billing dashboard');
      console.log('   2. Verify your plan includes the models you\'re trying to use');
      console.log('   3. Consider upgrading your plan if needed');
    } else {
      console.log('   1. All models are working correctly');
      console.log('   2. The issue may have been temporary');
    }
    
    console.log('');
    console.log(`🕐 Test completed at: ${new Date().toISOString()}`);
    console.log(`⏱️  Total test duration: ${Math.round((new Date() - this.startTime) / 1000)}s`);
  }
}

// Run the monitor
const monitor = new SyntheticRateMonitor();
monitor.runTest().catch(console.error);
