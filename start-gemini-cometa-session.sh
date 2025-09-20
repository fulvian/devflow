#!/bin/bash

# start-gemini-cometa-session.sh
# Questo script avvia una nuova sessione nel database Cometa e ne salva l'ID.
# Va eseguito all'inizio di ogni sessione di lavoro con Gemini CLI.

# Assicura che lo script si interrompa in caso di errore
set -e

# Imposta il percorso del progetto in modo che lo script possa essere eseguito da qualsiasi directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Imposta la variabile d'ambiente per il percorso del database
export DEVFLOW_DB_PATH="${PROJECT_ROOT}/data/devflow.sqlite"

# Definisci il percorso del file per l'ID di sessione
SESSION_ID_FILE="${PROJECT_ROOT}/.devflow/current_session.id"

# Esegui il CLI per creare una nuova sessione e cattura l'output JSON
echo "Avvio di una nuova sessione Cometa..."
SESSION_JSON=$("${PROJECT_ROOT}/scripts/cometa-gemini-cli.js" session:create)

# Estrai il sessionId dall'output JSON (usando un tool semplice come Node.js o Python se jq non è disponibile)
SESSION_ID=$(echo "$SESSION_JSON" | node -p "JSON.parse(require('fs').readFileSync(0, 'utf-8')).sessionId")

# Controlla se l'ID della sessione è stato ottenuto correttamente
if [ -z "$SESSION_ID" ]; then
  echo "Errore: Impossibile creare la sessione Cometa o estrarre l'ID."
  echo "Output ricevuto: $SESSION_JSON"
  exit 1
fi

# Salva l'ID della sessione nel file
echo -n "$SESSION_ID" > "$SESSION_ID_FILE"

# Notifica all'utente
echo "-----------------------------------------------------"
echo "✅ Sessione Cometa per Gemini CLI attivata."
echo "   ID Sessione: $SESSION_ID"
echo "   (salvato in .devflow/current_session.id)"
echo "-----------------------------------------------------"

# A questo punto, avvio automaticamente il processo Gemini CLI.
# Tutti gli argomenti passati a questo script verranno inoltrati a Gemini.
exec gemini "$@"
