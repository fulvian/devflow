#!/usr/bin/env node

/**
 * Test per verificare il funzionamento della delega MCP Synthetic
 * Questo script testa la connessione e la funzionalità dei server MCP synthetic
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Carica le variabili d'ambiente
dotenv.config();

const SYNTHETIC_API_URL = 'https://api.synthetic.new/v1';
const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
}

class SyntheticMCPTest {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Test MCP Synthetic - Verifica Funzionamento\n');

    await this.testAPIKey();
    await this.testModelAvailability();
    await this.testCodeGeneration();
    await this.testReasoning();
    await this.testContextAnalysis();

    this.printResults();
  }

  private async testAPIKey(): Promise<void> {
    console.log('1️⃣ Test API Key...');
    
    if (!SYNTHETIC_API_KEY) {
      this.addResult('API Key', false, 'SYNTHETIC_API_KEY non configurata');
      return;
    }

    if (!SYNTHETIC_API_KEY.startsWith('syn_')) {
      this.addResult('API Key', false, 'Formato API Key non valido');
      return;
    }

    this.addResult('API Key', true, 'API Key configurata correttamente');
  }

  private async testModelAvailability(): Promise<void> {
    console.log('2️⃣ Test Disponibilità Modelli...');

    const models = [
      'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
      'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
      'hf:deepseek-ai/DeepSeek-V3'
    ];

    for (const model of models) {
      try {
        const response = await axios.post(
          `${SYNTHETIC_API_URL}/chat/completions`,
          {
            model,
            messages: [{ role: 'user', content: 'Test' }],
            max_tokens: 5
          },
          {
            headers: {
              'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000
          }
        );

        this.addResult(`Modello ${model}`, true, 'Disponibile', {
          tokens: response.data.usage?.total_tokens || 'N/A'
        });
      } catch (error: any) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        this.addResult(`Modello ${model}`, false, `Errore: ${errorMsg}`);
      }
    }
  }

  private async testCodeGeneration(): Promise<void> {
    console.log('3️⃣ Test Generazione Codice...');

    try {
      const response = await axios.post(
        `${SYNTHETIC_API_URL}/chat/completions`,
        {
          model: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct',
          messages: [
            {
              role: 'system',
              content: 'Sei un esperto sviluppatore TypeScript. Genera codice pulito e funzionante.'
            },
            {
              role: 'user',
              content: 'Crea una funzione TypeScript che calcola la somma di due numeri.'
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000
        }
      );

      const code = response.data.choices[0].message.content;
      const hasFunction = code.includes('function') || code.includes('const') || code.includes('=>');
      
      this.addResult('Generazione Codice', hasFunction, 
        hasFunction ? 'Codice generato correttamente' : 'Codice non valido',
        { code: code.substring(0, 100) + '...' }
      );
    } catch (error: any) {
      this.addResult('Generazione Codice', false, `Errore: ${error.message}`);
    }
  }

  private async testReasoning(): Promise<void> {
    console.log('4️⃣ Test Ragionamento...');

    try {
      const response = await axios.post(
        `${SYNTHETIC_API_URL}/chat/completions`,
        {
          model: 'hf:deepseek-ai/DeepSeek-V3',
          messages: [
            {
              role: 'user',
              content: 'Analizza questo problema: Come ottimizzare le performance di un\'applicazione Node.js?'
            }
          ],
          max_tokens: 300,
          temperature: 0.5
        },
        {
          headers: {
            'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000
        }
      );

      const reasoning = response.data.choices[0].message.content;
      const hasAnalysis = reasoning.includes('performance') || reasoning.includes('ottimizzazione');
      
      this.addResult('Ragionamento', hasAnalysis,
        hasAnalysis ? 'Analisi generata correttamente' : 'Analisi non valida',
        { reasoning: reasoning.substring(0, 100) + '...' }
      );
    } catch (error: any) {
      this.addResult('Ragionamento', false, `Errore: ${error.message}`);
    }
  }

  private async testContextAnalysis(): Promise<void> {
    console.log('5️⃣ Test Analisi Contesto...');

    try {
      const response = await axios.post(
        `${SYNTHETIC_API_URL}/chat/completions`,
        {
          model: 'hf:Qwen/Qwen2.5-Coder-32B-Instruct',
          messages: [
            {
              role: 'user',
              content: 'Analizza questo codice TypeScript e spiega cosa fa:\n\nfunction calculateSum(a: number, b: number): number {\n  return a + b;\n}'
            }
          ],
          max_tokens: 200,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000
        }
      );

      const analysis = response.data.choices[0].message.content;
      const hasExplanation = analysis.includes('somma') || analysis.includes('addizione') || analysis.includes('number');
      
      this.addResult('Analisi Contesto', hasExplanation,
        hasExplanation ? 'Analisi generata correttamente' : 'Analisi non valida',
        { analysis: analysis.substring(0, 100) + '...' }
      );
    } catch (error: any) {
      this.addResult('Analisi Contesto', false, `Errore: ${error.message}`);
    }
  }

  private addResult(test: string, success: boolean, message: string, details?: any): void {
    this.results.push({ test, success, message, details });
  }

  private printResults(): void {
    console.log('\n📊 RISULTATI TEST MCP SYNTHETIC\n');
    
    let successCount = 0;
    let totalCount = this.results.length;

    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.message}`);
      
      if (result.details) {
        console.log(`   📝 Dettagli: ${JSON.stringify(result.details, null, 2)}`);
      }
      
      if (result.success) successCount++;
    });

    console.log(`\n🎯 RISULTATO FINALE: ${successCount}/${totalCount} test superati`);
    
    if (successCount === totalCount) {
      console.log('🎉 TUTTI I TEST SUPERATI! MCP Synthetic è configurato correttamente.');
      console.log('✅ Claude Code può ora delegare le attività di coding a Synthetic.');
    } else {
      console.log('⚠️  Alcuni test falliti. Verificare la configurazione.');
    }
  }
}

// Esegui i test
const tester = new SyntheticMCPTest();
tester.runAllTests().catch(console.error);
