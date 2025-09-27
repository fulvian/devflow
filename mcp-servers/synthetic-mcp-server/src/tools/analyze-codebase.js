import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

export const analyzeCodebaseTool = {
  name: 'analyze_codebase',
  description: 'Analizza la codebase esistente per fornire contesto per le generazioni/modifiche',
  inputSchema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Directory da analizzare (default: directory corrente)',
        default: '.'
      },
      extensions: {
        type: 'array',
        description: 'Estensioni file da includere',
        items: { type: 'string' },
        default: ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h']
      },
      maxFiles: {
        type: 'number',
        description: 'Numero massimo di file da analizzare',
        default: 20
      }
    }
  }
};

export async function executeAnalyzeCodebase(syntheticClient, args) {
  const { directory = '.', extensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs'], maxFiles = 20 } = args;

  try {
    // Pattern per glob
    const patterns = extensions.map(ext => `${directory}/**/*.${ext}`);
    
    // Trova tutti i file
    const files = [];
    for (const pattern of patterns) {
      const foundFiles = await glob(pattern, { 
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      });
      files.push(...foundFiles);
    }

    // Limita il numero di file
    const filesToAnalyze = files.slice(0, maxFiles);

    // Analizza i file
    const analysis = {
      totalFiles: files.length,
      analyzedFiles: filesToAnalyze.length,
      languages: {},
      structure: {},
      imports: [],
      exports: [],
      functions: [],
      classes: []
    };

    for (const file of filesToAnalyze) {
      const content = await fs.readFile(file, 'utf8');
      const ext = path.extname(file).slice(1);
      
      // Conta linguaggi
      analysis.languages[ext] = (analysis.languages[ext] || 0) + 1;

      // Struttura directory
      const dir = path.dirname(file);
      analysis.structure[dir] = (analysis.structure[dir] || 0) + 1;

      // Analisi semplificata del contenuto
      const lines = content.split('\n');
      
      // Trova import/export (JavaScript/TypeScript)
      if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
        lines.forEach(line => {
          if (line.trim().startsWith('import ')) {
            analysis.imports.push(line.trim());
          }
          if (line.trim().startsWith('export ')) {
            analysis.exports.push(line.trim());
          }
          if (line.includes('function ') || line.includes('const ') || line.includes('let ')) {
            const match = line.match(/(function\s+\w+|const\s+\w+|let\s+\w+)/);
            if (match) analysis.functions.push(`${file}: ${match[1]}`);
          }
          if (line.includes('class ')) {
            const match = line.match(/class\s+(\w+)/);
            if (match) analysis.classes.push(`${file}: ${match[1]}`);
          }
        });
      }
    }

    // Crea il prompt di contesto per synthetic.new
    const contextPrompt = `Analisi della codebase completata:

**Struttura del progetto:**
- File totali: ${analysis.totalFiles}
- File analizzati: ${analysis.analyzedFiles}
- Linguaggi: ${Object.keys(analysis.languages).join(', ')}

**Directory principali:**
${Object.entries(analysis.structure).map(([dir, count]) => `- ${dir}: ${count} file`).join('\n')}

**Linguaggi per numero di file:**
${Object.entries(analysis.languages).map(([lang, count]) => `- ${lang}: ${count} file`).join('\n')}

**Import più comuni:**
${analysis.imports.slice(0, 10).map(imp => `- ${imp}`).join('\n')}

**Funzioni/Classi principali:**
${[...analysis.functions.slice(0, 5), ...analysis.classes.slice(0, 5)].map(item => `- ${item}`).join('\n')}`;

    return {
      content: [{
        type: 'text',
        text: `📊 **Analisi Codebase Completata**

${contextPrompt}

💡 **Suggerimento:** Usa questi dati come contesto quando generi o modifichi codice per mantenere coerenza con la struttura esistente.`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore durante l'analisi: ${error.message}`
      }]
    };
  }
}