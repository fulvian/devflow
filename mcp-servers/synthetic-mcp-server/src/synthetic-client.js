import axios from 'axios';

export class SyntheticClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = process.env.SYNTHETIC_API_BASE_URL || 'https://api.synthetic.new/v1';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async generateCode(prompt, context = {}) {
    try {
      const response = await this.client.post('/completions', {
        model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        messages: [
          {
            role: 'system',
            content: `Sei un esperto sviluppatore. Genera codice di alta qualità seguendo le best practices. 
            Contesto del progetto: ${JSON.stringify(context)}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        stream: false
      });

      return {
        success: true,
        code: response.data.choices[0].message.content,
        usage: response.data.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  async editCode(existingCode, editInstructions, filePath) {
    try {
      const response = await this.client.post('/completions', {
        model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        messages: [
          {
            role: 'system',
            content: `Sei un esperto sviluppatore. Modifica il codice esistente seguendo le istruzioni fornite.
            Mantieni la struttura e lo stile del codice originale. Restituisci SOLO il codice modificato completo.
            File path: ${filePath}`
          },
          {
            role: 'user',
            content: `Codice esistente:
\`\`\`
${existingCode}
\`\`\`

Istruzioni per la modifica:
${editInstructions}

Restituisci il codice completo modificato:`
          }
        ],
        temperature: 0.1,
        max_tokens: 6000,
        stream: false
      });

      return {
        success: true,
        code: response.data.choices[0].message.content,
        usage: response.data.usage
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }
}