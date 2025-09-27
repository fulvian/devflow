#!/usr/bin/env node

/**
 * Synthetic API Model Availability Tester
 * 
 * Tests which models are available on Synthetic.new API
 * and handles billing errors gracefully
 */

import https from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = './configs/ccr-config.json';
const FALLBACK_CONFIG_PATH = './configs/ccr-config-fallback.json';

class SyntheticModelTester {
  constructor() {
    this.config = this.loadConfig();
    this.apiKey = this.config.Providers[0].api_key;
    this.baseUrl = this.config.Providers[0].api_base_url;
  }

  loadConfig() {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.error('Error loading config:', error.message);
      return JSON.parse(readFileSync(FALLBACK_CONFIG_PATH, 'utf8'));
    }
  }

  async testModel(modelName) {
    const payload = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: "Hello, can you respond with a simple greeting?"
        }
      ],
      max_tokens: 50,
      temperature: 0.7
    };

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'DevFlow-Synthetic-Tester/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              model: modelName,
              status: res.statusCode,
              success: res.statusCode === 200,
              response: response,
              error: res.statusCode !== 200 ? response : null
            });
          } catch (parseError) {
            resolve({
              model: modelName,
              status: res.statusCode,
              success: false,
              response: data,
              error: `Parse error: ${parseError.message}`
            });
          }
        });
      });

      req.on('error', (error) => {
        reject({
          model: modelName,
          success: false,
          error: error.message
        });
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async testAllModels() {
    console.log('🔍 Testing Synthetic API model availability...\n');
    
    const models = this.config.Providers[0].models;
    const results = [];

    for (const model of models) {
      console.log(`Testing model: ${model}`);
      
      try {
        const result = await this.testModel(model);
        results.push(result);
        
        if (result.success) {
          console.log(`✅ ${model} - Available`);
        } else {
          console.log(`❌ ${model} - Error: ${result.error?.message || result.error}`);
          
          // Check for specific billing errors
          if (result.error?.message?.includes('billing') || 
              result.error?.message?.includes('credit') ||
              result.status === 402) {
            console.log(`   💳 Billing issue detected for ${model}`);
          }
        }
      } catch (error) {
        console.log(`❌ ${model} - Network error: ${error.message}`);
        results.push({
          model,
          success: false,
          error: error.message
        });
      }
      
      console.log(''); // Empty line for readability
    }

    return results;
  }

  generateRecommendations(results) {
    console.log('📋 Recommendations:\n');
    
    const availableModels = results.filter(r => r.success);
    const billingErrors = results.filter(r => 
      r.error?.message?.includes('billing') || 
      r.error?.message?.includes('credit') ||
      r.status === 402
    );
    
    if (availableModels.length === 0) {
      console.log('❌ No models are currently available.');
      console.log('💡 Suggestions:');
      console.log('   - Check your Synthetic.new billing status');
      console.log('   - Verify API key is correct');
      console.log('   - Consider upgrading your plan');
    } else {
      console.log(`✅ ${availableModels.length} model(s) available:`);
      availableModels.forEach(model => {
        console.log(`   - ${model.model}`);
      });
    }
    
    if (billingErrors.length > 0) {
      console.log('\n💳 Billing issues detected:');
      billingErrors.forEach(model => {
        console.log(`   - ${model.model}: ${model.error?.message || 'Insufficient credits'}`);
      });
      console.log('\n💡 To resolve billing issues:');
      console.log('   - Visit https://synthetic.new/billing');
      console.log('   - Purchase credits or upgrade your plan');
      console.log('   - Use fallback models in the meantime');
    }
    
    // Recommend best available model for Codex
    const codexModels = availableModels.filter(r => 
      r.model.includes('Qwen') && r.model.includes('Coder')
    );
    
    if (codexModels.length > 0) {
      console.log(`\n🎯 Recommended model for Codex: ${codexModels[0].model}`);
    } else if (availableModels.length > 0) {
      console.log(`\n🎯 Fallback model for Codex: ${availableModels[0].model}`);
    }
  }

  async run() {
    try {
      const results = await this.testAllModels();
      this.generateRecommendations(results);
      
      // Save results for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsFile = `./test-results-synthetic-${timestamp}.json`;
      
      import('fs').then(fs => {
        fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
        console.log(`\n📄 Results saved to: ${resultsFile}`);
      });
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the tester
const tester = new SyntheticModelTester();
tester.run().catch(console.error);
