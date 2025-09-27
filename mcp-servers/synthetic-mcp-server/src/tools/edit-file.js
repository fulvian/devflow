import fs from 'fs-extra';
import path from 'path';

export const editFileTool = {
  name: 'edit_file',
  description: 'Modifica un file esistente utilizzando synthetic.new',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Percorso del file da modificare'
      },
      instructions: {
        type: 'string',
        description: 'Istruzioni dettagliate per la modifica'
      },
      backup: {
        type: 'boolean',
        description: 'Crea un backup del file originale',
        default: true
      }
    },
    required: ['filePath', 'instructions']
  }
};

export async function executeEditFile(syntheticClient, args) {
  const { filePath, instructions, backup = true } = args;

  try {
    // Verifica che il file esista
    if (!await fs.pathExists(filePath)) {
      return {
        content: [{
          type: 'text',
          text: `❌ File non trovato: ${filePath}`
        }]
      };
    }

    // Leggi il contenuto esistente
    const existingCode = await fs.readFile(filePath, 'utf8');

    // Crea backup se richiesto
    if (backup) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copy(filePath, backupPath);
    }

    // Chiama synthetic.new per modificare il codice
    const result = await syntheticClient.editCode(existingCode, instructions, filePath);

    if (!result.success) {
      return {
        content: [{
          type: 'text',
          text: `❌ Errore nella modifica del file: ${result.error}`
        }]
      };
    }

    // Estrai il codice modificato
    let modifiedCode = result.code;
    const codeBlockMatch = modifiedCode.match(/```(?:\w+)?\n([\\s\\S]*?)```/);
    if (codeBlockMatch) {
      modifiedCode = codeBlockMatch[1];
    }

    // Salva le modifiche
    await fs.writeFile(filePath, modifiedCode, 'utf8');

    // Calcola le differenze
    const originalLines = existingCode.split('\n').length;
    const modifiedLines = modifiedCode.split('\n').length;

    return {
      content: [{
        type: 'text',
        text: `✅ File modificato con successo: ${filePath}

📊 **Statistiche modifiche:**
- Token utilizzati: ${result.usage?.total_tokens || 'N/A'}
- Linee originali: ${originalLines}
- Linee modificate: ${modifiedLines}
- Differenza: ${modifiedLines - originalLines > 0 ? '+' : ''}${modifiedLines - originalLines} linee
${backup ? `- Backup creato: ${filePath}.backup.${Date.now()}` : ''}

📝 **Istruzioni applicate:**
${instructions}`
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Errore durante la modifica: ${error.message}`
      }]
    };
  }
}