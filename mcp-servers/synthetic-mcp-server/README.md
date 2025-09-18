# Synthetic MCP Server

MCP Server per integrazione synthetic.new con Qwen CLI per editing automatico del codice tramite il modello Qwen3-Coder-480B.

## Strumenti disponibili

1. **generate_code** - Genera nuovo codice e lo salva in un file
2. **edit_file** - Modifica un file esistente
3. **analyze_codebase** - Analizza la codebase esistente per fornire contesto

## Configurazione

1. Installa le dipendenze:
   ```bash
   npm install
   ```

2. Il server utilizzerà automaticamente la configurazione da `../.env` (il file .env nella directory devflow principale)

3. Installa il server globalmente:
   ```bash
   npm link
   ```

4. Configura Qwen CLI modificando `~/.qwen/settings.json`:
   ```json
   {
     "mcpServers": {
       "synthetic": {
         "command": "synthetic-mcp"
       }
     }
   }
   ```

   Oppure puoi usare il file di configurazione di esempio:
   ```bash
   cp .qwen-config.example.json ~/.qwen/settings.json
   ```

## Utilizzo

Una volta configurato, potrai utilizzare questi comandi in Qwen CLI:

- `Utilizza synthetic per generare una funzione JavaScript per validare email in src/utils/validation.js`
- `Usa synthetic per aggiungere gestione errori al file src/api/users.js`
- `Analizza la codebase corrente con synthetic per comprendere la struttura del progetto`

## Test del server

Puoi testare il server eseguendo:

```bash
echo '{"method": "initialize", "params": {"protocolVersion": "2024-08-07", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | synthetic-mcp
```

Questo dovrebbe avviare il server senza errori.