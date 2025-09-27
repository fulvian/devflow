// EmbeddingGemma Diagnostic
const { exec } = require('child_process');
const fs = require('fs');

class EmbeddingDiagnostic {
  async checkEmbeddingGemma() {
    console.log('🧠 EMBEDDINGGEMMA DIAGNOSTIC');
    console.log('=' * 50);
    
    // Check if Ollama is installed
    console.log('Checking Ollama installation...');
    
    return new Promise((resolve) => {
      exec('ollama --version', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Ollama not installed or not in PATH');
          console.log(`Error: ${error.message}`);
          resolve(false);
          return;
        }
        
        console.log(`✅ Ollama version: ${stdout.trim()}`);
        
        // Check if EmbeddingGemma model is available
        exec('ollama list', (error, stdout, stderr) => {
          if (error) {
            console.log('❌ Cannot list Ollama models');
            resolve(false);
            return;
          }
          
          console.log('\n📋 Available models:');
          console.log(stdout);
          
          const hasEmbeddingGemma = stdout.includes('embeddinggemma') || stdout.includes('embedding');
          console.log(`\nEmbeddingGemma available: ${hasEmbeddingGemma ? '✅' : '❌'}`);
          
          if (hasEmbeddingGemma) {
            // Test embedding generation using correct API
            console.log('\n🧪 Testing embedding generation...');
            const curlCmd = `curl -s -X POST http://localhost:11434/api/embeddings -H "Content-Type: application/json" -d '{"model": "embeddinggemma", "prompt": "test embedding"}'`;
            
            exec(curlCmd, { timeout: 15000 }, (error, stdout, stderr) => {
              if (error) {
                console.log('❌ Embedding API test failed');
                console.log(`Error: ${error.message}`);
                resolve(false);
              } else {
                try {
                  const response = JSON.parse(stdout);
                  if (response.embedding && Array.isArray(response.embedding)) {
                    console.log('✅ Embedding generation successful');
                    console.log(`   Vector dimensions: ${response.embedding.length}`);
                    console.log(`   Sample values: [${response.embedding.slice(0,3).join(', ')}...]`);
                    resolve(true);
                  } else {
                    console.log('❌ Invalid embedding response format');
                    console.log(`Response: ${stdout.substring(0, 200)}...`);
                    resolve(false);
                  }
                } catch (e) {
                  console.log('❌ Failed to parse embedding response');
                  console.log(`Raw response: ${stdout.substring(0, 200)}...`);
                  resolve(false);
                }
              }
            });
          } else {
            resolve(false);
          }
        });
      });
    });
  }
}

if (require.main === module) {
  new EmbeddingDiagnostic().checkEmbeddingGemma();
}

module.exports = EmbeddingDiagnostic;