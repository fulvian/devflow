# DevFlow File Deletion Feature

## 🎯 Overview

Il sistema DevFlow ora supporta operazioni di cancellazione file attraverso il server MCP Synthetic Dual Enhanced. Questa funzionalità permette di eliminare file in modo sicuro e controllato.

## 🔧 Configuration

### Environment Variables

Aggiungi queste variabili al tuo file `.env` o alle variabili d'ambiente:

```bash
# File Operations
AUTONOMOUS_FILE_OPERATIONS=true
CREATE_BACKUPS=true
SYNTHETIC_DELETE_ENABLED=true

# Security Settings
REQUIRE_APPROVAL=false
ALLOWED_FILE_EXTENSIONS=.ts,.js,.json,.md,.py,.tsx,.jsx,.css,.scss,.html,.yml,.yaml
```

### Default Values

- `SYNTHETIC_DELETE_ENABLED`: `true` (default)
- `AUTONOMOUS_FILE_OPERATIONS`: `true` (default)
- `CREATE_BACKUPS`: `true` (default)

## 🚀 Usage

### Tool Schema

Il tool `synthetic_auto_file_dual` ora include il parametro `allow_deletion`:

```json
{
  "name": "synthetic_auto_file_dual",
  "inputSchema": {
    "type": "object",
    "properties": {
      "task_id": {
        "type": "string",
        "description": "Task identifier (e.g., DEVFLOW-DUAL-001)"
      },
      "request": {
        "type": "string",
        "description": "Task description for autonomous code generation and file modification"
      },
      "allow_deletion": {
        "type": "boolean",
        "description": "Allow file deletion operations",
        "default": true
      }
    }
  }
}
```

### Example Usage

```typescript
// Esempio di operazione con cancellazione abilitata
const result = await synthetic_auto_file_dual({
  task_id: "DEVFLOW-DELETE-001",
  request: "Remove temporary files and clean up unused components",
  allow_deletion: true,
  create_backup: true,
  dry_run: false
});
```

## 🛡️ Security Features

### 1. Path Validation
- Solo file all'interno del `DEVFLOW_PROJECT_ROOT` possono essere cancellati
- Controllo rigoroso dei percorsi per prevenire cancellazioni accidentali

### 2. File Extension Control
- Solo estensioni file autorizzate possono essere cancellate
- Lista configurabile tramite `ALLOWED_FILE_EXTENSIONS`

### 3. Permission Checks
- Controllo `SYNTHETIC_DELETE_ENABLED` per abilitare/disabilitare globalmente
- Controllo `allow_deletion` per operazioni specifiche

### 4. Backup System
- Backup automatico prima della cancellazione (se `CREATE_BACKUPS=true`)
- Sistema di cleanup automatico per backup vecchi (>24h)

## 📋 File Modification Interface

L'interfaccia `FileModification` è stata aggiornata:

```typescript
interface FileModification {
  file: string;
  operation: 'write' | 'append' | 'patch' | 'create' | 'delete';
  content?: string; // Opzionale per operazioni 'delete'
  storage_specific?: {
    create_task_entry?: boolean;
    update_memory_blocks?: boolean;
  };
}
```

## 🔄 Operation Flow

### Delete Operation Logic

```typescript
case 'delete':
  if (existsSync(fullPath)) {
    await fs.unlink(fullPath);
    return {
      path: modification.file,
      status: 'SUCCESS',
      message: 'File deleted successfully'
    };
  } else {
    return {
      path: modification.file,
      status: 'SKIPPED',
      message: 'File does not exist'
    };
  }
```

## 📊 Response Format

### Success Response
```json
{
  "path": "path/to/deleted/file.ts",
  "status": "SUCCESS",
  "message": "File deleted successfully"
}
```

### Skipped Response
```json
{
  "path": "path/to/non-existent/file.ts",
  "status": "SKIPPED",
  "message": "File does not exist"
}
```

### Error Response
```json
{
  "path": "path/to/file.ts",
  "status": "ERROR",
  "message": "File deletion not enabled. Set SYNTHETIC_DELETE_ENABLED=true to enable."
}
```

## 🧪 Testing

Un test completo è disponibile in `test-file-deletion.ts`:

```bash
npx tsx test-file-deletion.ts
```

Il test verifica:
- ✅ Creazione file di test
- ✅ Verifica esistenza file
- ✅ Cancellazione file
- ✅ Verifica cancellazione
- ✅ Gestione file inesistenti
- ✅ Cleanup automatico

## 🔍 Debugging

### Log Messages

Il sistema fornisce log dettagliati per il debugging:

```
[MCP DEBUG] Starting applyFileModification for: path/to/file.ts
[MCP DEBUG] Resolved absolute path: /full/path/to/file.ts
[MCP DEBUG] Path is allowed.
[MCP DEBUG] File extension .ts is allowed.
[MCP DEBUG] Performing operation 'delete' on /full/path/to/file.ts.
[MCP DEBUG] File deleted successfully: /full/path/to/file.ts
```

### Error Handling

Errori comuni e soluzioni:

1. **"File deletion not enabled"**
   - Soluzione: Impostare `SYNTHETIC_DELETE_ENABLED=true`

2. **"Path not allowed"**
   - Soluzione: Verificare che il file sia dentro `DEVFLOW_PROJECT_ROOT`

3. **"File extension not allowed"**
   - Soluzione: Aggiungere l'estensione a `ALLOWED_FILE_EXTENSIONS`

## 🎯 Best Practices

1. **Sempre abilitare i backup** (`CREATE_BACKUPS=true`)
2. **Usare dry_run=true** per testare operazioni di cancellazione
3. **Verificare i percorsi** prima di eseguire cancellazioni
4. **Monitorare i log** per debugging
5. **Testare in ambiente di sviluppo** prima della produzione

## 🔄 Integration

La funzionalità si integra perfettamente con:
- Sistema di storage dual-mode (cc-sessions / multi-layer)
- Sistema di backup automatico
- Logging e monitoring
- Controlli di sicurezza esistenti

---

**Implementazione completata con successo!** ✅

Il sistema DevFlow ora supporta operazioni di cancellazione file sicure e controllate.
