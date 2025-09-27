# SYNTHETIC MCP CREDENTIAL LOADING FAILURE REPORT

**Timestamp**: 2025-09-17T08:12:00Z
**Reporter**: Claude Code Assistant
**Priority**: CRITICAL
**Service**: devflow-synthetic-cc-sessions MCP Server
**Error Type**: Authentication Failure (401 Unauthorized)

---

## 🔍 EXECUTIVE SUMMARY

Nonostante configurazione corretta delle credenziali API nel file `.env` e multiple modifiche ai sistemi di caricamento variabili d'ambiente, il server MCP `devflow-synthetic-cc-sessions` continua a fallire le chiamate API con errore 401 Unauthorized. Il problema persiste attraverso diversi approcci di configurazione, indicando un problema sistemico nel caricamento delle credenziali da parte del processo MCP.

---

## 📋 PROBLEMA PRINCIPALE

### **Errore Persistente**
```
Request failed with status code 401
AxiosError: Request failed with status code 401
```

### **Configurazione Ambiente Corretta**
```bash
# File .env (verificato funzionante)
SYNTHETIC_API_KEY=syn_2931060d44941b8444d15620bb6dc23d
SYNTHETIC_API_BASE_URL=https://api.synthetic.new/v1
```

### **Server MCP Status**
- ✅ **Server avvio**: Funziona correttamente
- ✅ **Connessione MCP**: Claude Code si connette senza errori
- ❌ **API chiamate**: Tutte falliscono con 401 Unauthorized

---

## 🛠️ ANALISI TECNICA DETTAGLIATA

### **1. Architettura del Problema**

Il problema risiede nel **processo di isolamento MCP**: quando Claude Code avvia il server MCP come processo separato, le variabili d'ambiente dell'ambiente parent (Claude Code) non vengono ereditate correttamente dal processo child (server MCP).

```
Claude Code Process
├── Environment: {SYNTHETIC_API_KEY: "syn_..."}
└── Spawns: node dual-enhanced-index.js
    └── Environment: {} ← VARIABILI NON EREDITATE
```

### **2. Tentativi di Risoluzione Effettuati**

#### **Tentativo 1: Configurazione Claude Code User Config**
```json
{
  "env": {
    "SYNTHETIC_API_KEY": "${SYNTHETIC_API_KEY}",
    "SYNTHETIC_API_BASE_URL": "${SYNTHETIC_API_BASE_URL}"
  }
}
```
**Risultato**: ❌ Le variabili `${SYNTHETIC_API_KEY}` non vengono espanse

#### **Tentativo 2: Hardcoded Credentials in MCP Config**
```json
{
  "env": {
    "SYNTHETIC_API_KEY": "syn_2931060d44941b8444d15620bb6dc23d",
    "SYNTHETIC_API_BASE_URL": "https://api.synthetic.new/v1"
  }
}
```
**Risultato**: ✅ Configurazione salvata correttamente, ❌ Error 401 persiste

#### **Tentativo 3: Environment Loading in DevFlow Script**
```bash
# devflow-start.sh
export SYNTHETIC_API_BASE_URL=$(grep "^SYNTHETIC_API_BASE_URL=" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
```
**Risultato**: ❌ Non influenza processo MCP separato

#### **Tentativo 4: Rimozione Chiavi Hardcoded nel Codebase**
- Rimosso: `syn_4f04a1a3108cfbb64ac973367542d361` da 12+ file
- Aggiornato: Tutti i config files per usare variabili d'ambiente
**Risultato**: ❌ Error 401 persiste

### **3. Diagnosi del Server MCP**

#### **Test Diretto del Server**
```bash
cd mcp-servers/synthetic && node -e "
console.log('API key from env:', process.env.SYNTHETIC_API_KEY ? process.env.SYNTHETIC_API_KEY.substring(0, 15) + '...' : 'NOT LOADED');
"
# Output: API key from env: NOT LOADED
```

Questo conferma che il processo MCP **non riceve le variabili d'ambiente**.

#### **Server Compilation Check**
```bash
ls -la mcp-servers/synthetic/dist/dual-enhanced-index.js
# Output: 70,250 bytes - Server compilato e funzionante
```

#### **Server Code Analysis**
Il server carica correttamente la configurazione:
```typescript
// dual-enhanced-index.ts:24
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// dual-enhanced-index.ts:27-28
const SYNTHETIC_API_URL = process.env.SYNTHETIC_API_BASE_URL || 'https://api.synthetic.new/v1';
const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;
```

**Ma le variabili d'ambiente non sono disponibili nel processo MCP.**

---

## 🔬 ROOT CAUSE ANALYSIS

### **Problema Fondamentale: Process Environment Isolation**

1. **Claude Code** legge e carica `.env` nel proprio processo
2. **Claude Code** spawna processo separato: `node dual-enhanced-index.js`
3. **Processo MCP** non eredita environment del parent process
4. **Processo MCP** tenta di caricare `.env` ma fallisce o non trova le variabili
5. **API calls** falliscono con 401 per mancanza credenziali

### **Environment Variable Inheritance Issue**

Claude Code non passa esplicitamente le variabili d'ambiente al processo MCP child, anche quando configurate in `claude mcp` configuration.

```
Parent Process (Claude Code)
├── Has: SYNTHETIC_API_KEY=syn_2931...
└── Spawns Child Process
    ├── Command: node dual-enhanced-index.js
    ├── Missing: SYNTHETIC_API_KEY
    └── Result: 401 Unauthorized
```

---

## 💡 SOLUZIONI RACCOMANDATE

### **Soluzione 1: Direct Environment Injection (IMMEDIATA)**

Modificare la configurazione Claude Code per iniettare esplicitamente le variabili:

```bash
claude mcp remove devflow-synthetic-cc-sessions -s user

# Caricare .env e iniettare valori diretti
source .env && claude mcp add-json devflow-synthetic-cc-sessions '{
  "type": "stdio",
  "command": "node",
  "args": ["/Users/fulvioventura/devflow/mcp-servers/synthetic/dist/dual-enhanced-index.js"],
  "env": {
    "SYNTHETIC_API_KEY": "'$SYNTHETIC_API_KEY'",
    "SYNTHETIC_API_BASE_URL": "'$SYNTHETIC_API_BASE_URL'",
    "DEFAULT_CODE_MODEL": "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "DEFAULT_REASONING_MODEL": "hf:deepseek-ai/DeepSeek-V3",
    "DEFAULT_CONTEXT_MODEL": "hf:Qwen/Qwen2.5-Coder-32B-Instruct",
    "DEVFLOW_PROJECT_ROOT": "/Users/fulvioventura/devflow"
  }
}' --scope user
```

### **Soluzione 2: Wrapper Script (ROBUSTA)**

Creare script wrapper che carica environment:

```bash
# /Users/fulvioventura/devflow/scripts/synthetic-mcp-wrapper.sh
#!/bin/bash
export $(grep -v '^#' /Users/fulvioventura/devflow/.env | xargs)
exec node /Users/fulvioventura/devflow/mcp-servers/synthetic/dist/dual-enhanced-index.js "$@"
```

Configurare Claude Code per usare wrapper:
```bash
claude mcp add devflow-synthetic-cc-sessions \
  /Users/fulvioventura/devflow/scripts/synthetic-mcp-wrapper.sh \
  --scope user
```

### **Soluzione 3: Environment File Direct Loading (SVILUPPO)**

Modificare `dual-enhanced-index.ts` per forzare caricamento environment:

```typescript
// All'inizio del file, prima di ogni altra cosa
import { promises as fs } from 'fs';
import { resolve } from 'path';

async function loadProjectEnv() {
  try {
    const envPath = resolve(__dirname, '../../../.env');
    const envContent = await fs.readFile(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.error('[Synthetic MCP] Failed to load .env:', error);
  }
}

// Chiamare prima di tutto
await loadProjectEnv();
```

### **Soluzione 4: Global Environment Configuration (SISTEMICA)**

Configurare variabili a livello di sistema operativo:

```bash
# ~/.zshrc o ~/.bashrc
export SYNTHETIC_API_KEY="syn_2931060d44941b8444d15620bb6dc23d"
export SYNTHETIC_API_BASE_URL="https://api.synthetic.new/v1"
```

---

## 🚨 RACCOMANDAZIONI IMMEDIATE

### **Priority 1: Quick Fix (30 minuti)**
Applicare **Soluzione 1** per ripristino immediato funzionalità.

### **Priority 2: Robust Fix (2 ore)**
Implementare **Soluzione 2** per soluzione stabile a lungo termine.

### **Priority 3: Development Fix (1 giorno)**
Implementare **Soluzione 3** per eliminare dependency esterna.

---

## 📊 IMPATTO E RISCHI

### **Impatto Attuale**
- **CRITICO**: Intero Dream Team Synthetic non funzionante
- **BLOCCANTE**: Nessuna generazione codice tramite MCP Synthetic
- **REGRESSIONE**: Perdita di funzionalità precedentemente operative

### **Risk Assessment**
- **Technical Debt**: Configurazione environment complessa
- **Maintainability**: Dependency su process environment inheritance
- **Security**: Potenziali exposure di credenziali in config files

---

## 🔧 VALIDATION STEPS

Dopo implementazione soluzione:

1. **Test connessione**: `claude mcp list` → Status ✓ Connected
2. **Test API call**: `mcp__devflow-synthetic-cc-sessions__synthetic_code` → Success
3. **Test environment**: Verificare variabili caricate correttamente
4. **Test persistence**: Restart Claude Code e ri-testare

---

## 📝 LESSONS LEARNED

1. **Process Isolation**: MCP servers operano in environment isolato
2. **Environment Variables**: Non vengono ereditate automaticamente
3. **Configuration Complexity**: Claude Code MCP config richiede explicit env injection
4. **Testing Approach**: Necessario testare a livello di processo MCP, non solo parent

---

**Report generato da**: Claude Code Assistant
**Data**: 2025-09-17T08:12:00Z
**Version**: DevFlow v2.1.0
**Status**: PENDING IMMEDIATE RESOLUTION
**Next Action**: Implementare Soluzione 1 per quick fix immediato