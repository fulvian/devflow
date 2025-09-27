import fs from 'fs-extra';
import path from 'path';

export const generateCodeTool = {
  name: 'generate_code',
  description: 'Genera nuovo codice utilizzating synthetic.new e lo salva in un file',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Descrizione dettagliata del codice da generare'
      },
      filePath: {
        type: 'string',
        description: 'Percorso dove salvare il file generato (relativo alla directory corrente)'
      },
      language: {
        type: 'string',
        description: 'Linguaggio di programmazione (es: javascript, python, go, rust)'
      },
      context: {
        type: 'object',
        description: 'Contesto aggiuntivo del progetto'
      }
    },
    required: ['prompt', 'filePath']
  }
};

export async function executeGenerateCode(syntheticClient, args) {
  // More robust parameter handling
  console.error('DEBUG: Raw args received:', JSON.stringify(args, null, 2));
  
  // Handle case where args might be nested
  let params = args;
  if (args && typeof args === 'object' && args.arguments) {
    params = args.arguments;
  }
  
  console.error('DEBUG: Processed params:', JSON.stringify(params, null, 2));
  
  // Validate required parameters with better error messages
  if (!params) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore nei parametri: Nessun parametro ricevuto`
      }]
    };
  }
  
  if (typeof params !== 'object') {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore nei parametri: Parametri non validi, ricevuto ${typeof params}`
      }]
    };
  }
  
  if (!params.prompt) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore nei parametri: Manca il parametro 'prompt'. Parametri disponibili: ${Object.keys(params).join(', ')}`
      }]
    };
  }
  
  if (!params.filePath) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore nei parametri: Manca il parametro 'filePath'. Parametri disponibili: ${Object.keys(params).join(', ')}`
      }]
    };
  }

  const { prompt, filePath, language = 'javascript', context = {} } = params;

  try {
    // Aggiungi il linguaggio al prompt
    const enhancedPrompt = `Genera codice ${language} per: ${prompt}
    
Assicurati che il codice:
- Sia ben commentato e leggibile
- Segua le best practices per ${language}
- Includa gestione degli errori dove appropriato
- Sia production-ready`;

    const result = await syntheticClient.generateCode(enhancedPrompt, { 
      ...context, 
      language,
      targetFile: filePath 
    });

    if (!result.success) {
      return {
        content: [{
          type: 'text',
          text: `❌ Errore nella generazione del codice: ${result.error}`
        }]
      };
    }

    // Estrai solo il codice dal response (rimuovi markdown formatting se presente)
    let code = result.code;
    const codeBlockMatch = code.match(/```(?:\w+)?\n([\\s\\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    // Crea la directory se non exists
    const dir = path.dirname(filePath);
    if (dir !== '.') {
      await fs.ensureDir(dir);
    }

    // Salva il file
    await fs.writeFile(filePath, code, 'utf8');

    return {
      content: [{
        type: 'text',
        text: `✅ Codice generato e salvato in: ${filePath}

📊 **Statistiche:**
- Token utilizzati: ${result.usage?.total_tokens || 'N/A'}
- Linee di codice: ${code.split('\n').length}

📝 **Preview del codice generato:**
\`\`\`${language}
${code.split('\n').slice(0, 20).join('\n')}${code.split('\n').length > 20 ? '\n...' : ''}
\`\`\``
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore durante la generazione: ${error.message}`
      }]
    };
  }
}