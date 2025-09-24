<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# voglio implementare un completo sistema di iniezione di contesto nel flusso di lavoro di Claude code, attivandolo automaticamente tramite hook . in quali punti dovrei predisporre i trigger per iniezione di contesto?

Un sistema completo di iniezione di contesto per Claude Code richiede trigger strategicamente posizionati in **punti critici del workflow** per catturare e fornire informazioni contestuali rilevanti in modo automatico [^1][^2].

## Trigger di Pre-Elaborazione

### UserPromptSubmit Hook

Il punto più importante per l'iniezione di contesto è l'hook `UserPromptSubmit`, che si attiva prima che Claude elabori il prompt dell'utente [^1]. Questo trigger permette di:

- Analizzare il contenuto del prompt per determinare il contesto necessario
- Iniettare automaticamente documentazione, standard di codifica o configurazioni pertinenti
- Aggiungere timestamp, informazioni di ambiente o metadati del progetto


### SessionStart Hook

L'hook `SessionStart` è ideale per caricare il contesto base all'avvio di una nuova sessione [^1]. Qui puoi iniettare:

- Configurazioni globali del progetto dal file CLAUDE.md
- Architettura del progetto e convenzioni di naming
- Dipendenze attive e versioni delle librerie


## Trigger di Strumenti e Operazioni

### PreToolUse Hook

Prima che Claude esegua qualsiasi tool, il trigger `PreToolUse` consente di [^1]:

- Iniettare contesto specifico per il tipo di operazione (lettura, scrittura, bash)
- Aggiungere informazioni sui file correlati o dipendenze
- Fornire pattern di sicurezza o best practices per l'operazione specifica


### PostToolUse Hook

Dopo l'esecuzione di un tool, `PostToolUse` permette di aggiungere contesto derivato dai risultati [^1]:

- Analisi automatica dell'output per estrarre informazioni rilevanti
- Feedback sui risultati dell'operazione per guidare le azioni successive
- Logging delle modifiche per mantenere la tracciabilità


## Trigger Basati su Eventi Specifici

### Trigger di Modifica File

Configura hook specifici per pattern di file utilizzando matcher come `Edit|Write` per [^1]:

- Iniettare standard di formattazione quando vengono modificati file di codice
- Aggiungere template o boilerplate per nuovi file
- Fornire contesto sui test correlati quando si modifica codice di produzione


### Trigger di Comando Bash

Per operazioni bash critiche, usa matcher specifici per iniettare [^3]:

- Variabili d'ambiente del progetto
- Path e configurazioni specifiche del sistema
- Informazioni sui servizi attivi e loro stati


## Trigger di Gestione Sessione

### Notification Hook

L'hook `Notification` cattura eventi di sistema e notifiche per [^1]:

- Iniettare contesto basato sullo stato dell'applicazione
- Aggiungere informazioni sui processi completati o errori verificatisi
- Fornire suggerimenti per le azioni successive


### Stop/SubagentStop Hook

Prima che Claude termini un'operazione, questi hook permettono di [^1]:

- Iniettare summary delle operazioni completate
- Aggiungere checklist di validazione o prossimi passi
- Fornire contesto per la continuazione del lavoro


## Implementazione Strategica

### Configurazione nel File Settings

Organizza gli hook nel file `.claude/settings.json` con pattern matcher specifici [^1]:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{"type": "command", "command": "./inject-context.py"}]
    }],
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{"type": "command", "command": "./code-context.sh"}]
    }]
  }
}
```


### Variabili di Ambiente

Sfrutta le variabili disponibili come `$CLAUDE_PROJECT_DIR`, `$CLAUDE_TOOL_NAME`, e `$CLAUDE_FILE_PATHS` per rendere dinamico l'injection [^3].

### Context Engineering Avanzato

Implementa un sistema multi-livello che combina [^4]:

- Intent translation per chiarire i requisiti dell'utente
- Retrieval semantico per documentazione pertinente
- Synthesis automatica di informazioni contestuali
- Orchestrazione intelligente tra diversi agenti specializzati

Il successo del sistema dipende dal bilanciamento tra completezza del contesto e efficienza computazionale, posizionando i trigger nei momenti di massima utilità informativa senza appesantire eccessivamente il workflow [^2][^5].
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^6][^7][^8][^9]</span>

```
<div style="text-align: center">⁂</div>
```

[^1]: https://docs.claude.com/en/docs/claude-code/hooks

[^2]: https://apidog.com/blog/claude-code-context-command-custom-tools-hooks-sdk/

[^3]: https://apidog.com/blog/claude-code-hooks/

[^4]: https://arxiv.org/html/2508.08322v1

[^5]: https://dev.to/letanure/claude-code-part-3-conversation-management-and-context-3l28

[^6]: https://www.anthropic.com/engineering/claude-code-best-practices

[^7]: https://www.reddit.com/r/ClaudeAI/comments/1loodjn/claude_code_now_supports_hooks/

[^8]: https://www.cometapi.com/claude-code-hooks-what-is-and-how-to-use-it/

[^9]: https://www.sidetool.co/post/how-to-automate-tasks-with-claude-code-workflow-for-developers

[^10]: https://www.eesel.ai/blog/claude-code-workflow-automation

[^11]: https://community.openai.com/t/best-method-of-injecting-relatively-large-amount-of-context-to-be-leveraged-in-a-response/218996

[^12]: https://github.com/disler/claude-code-hooks-mastery

[^13]: https://docs.port.io/guides/all/trigger-claude-code-from-port/

[^14]: https://www.newline.co/@zaoyang/dynamic-context-injection-with-retrieval-augmented-generation--68b80921

[^15]: https://www.claudelog.com/claude-code-mcps/context7-mcp/

[^16]: https://www.reddit.com/r/ClaudeAI/comments/1le62pg/beginner_question_how_can_i_automate_workflow/

[^17]: https://www.qodo.ai/blog/context-engineering/

[^18]: https://github.com/anthropics/claude-code/issues/6986

[^19]: https://blog.gitbutler.com/automate-your-ai-workflows-with-claude-code-hooks

[^20]: https://neuraltrust.ai/blog/prompt-injection-detection-llm-stack

[^21]: https://www.linkedin.com/posts/lewisowain_how-to-master-claude-code-hooks-activity-7351573925132206082-8jnp

[^22]: https://www.reddit.com/r/ClaudeAI/comments/1lt4dz7/claude_code_love_the_power_hate_the_context/

[^23]: https://github.com/anthropics/claude-code/issues/4464

[^24]: https://selah.net/apex-triggers-in-salesforce-best-practices-pitfalls-and-pro-level-tips/

[^25]: https://github.com/hesreallyhim/awesome-claude-code

[^26]: https://salesforcestack.com/salesforce-trigger-context-variables-explained/

[^27]: https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_intro

[^28]: https://bagerbach.com/blog/how-i-use-claude-code/

[^29]: https://www.iterativelogic.com/salesforce-apex-trigger-best-practices/

[^30]: https://prefactor.tech/blog/how-to-secure-claude-code-mcp-integrations-in-production

[^31]: https://trailhead.salesforce.com/content/learn/modules/platform-events-debugging/apply-best-practices-writing-platform-triggers

[^32]: https://www.linkedin.com/pulse/leveraging-salesforce-triggers-context-variables-papia-chakraborty-apozf

[^33]: https://www.reddit.com/r/SalesforceDeveloper/comments/elvt4a/best_practices_for_triggers/

[^34]: https://s2-labs.com/developer-tutorials/best-practice-with-triggers/

<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Guida Completa al Sistema di Hook di Claude Code

Il sistema di hook di Claude Code rappresenta una **rivoluzione nell'automazione dei flussi di lavoro AI**, permettendo di eseguire comandi shell personalizzati in momenti specifici del ciclo di vita di Claude [^1][^2].

## Architettura del Sistema Hook

### Definizione e Funzionamento

Gli hook sono **comandi shell definiti dall'utente** che si attivano automaticamente in punti predeterminati del workflow di Claude Code, garantendo controllo deterministico e automazione affidabile [^3][^2]. A differenza delle richieste basate su prompt, gli hook garantiscono che operazioni critiche come linting, formattazione e notifiche avvengano **sempre** senza intervento manuale.

### Configurazione Base

Gli hook si configurano nel file `.claude/settings.json` del progetto:

```json
{
  "hooks": {
    "EventType": [{
      "matcher": "pattern",
      "hooks": [{
        "type": "command",
        "command": "script.sh"
      }]
    }]
  }
}
```


## Gli 8 Tipi di Hook Fondamentali

### 1. UserPromptSubmit Hook

**Attivazione**: Immediatamente quando l'utente invia un prompt, prima che Claude lo elabori [^4].

**Payload disponibile**: `prompt` (testo), `session_id`, timestamp

**Casi d'uso principali**:

- Validazione e filtering di sicurezza dei prompt
- Iniezione automatica di contesto del progetto
- Logging delle richieste utente per auditing

**Esempio pratico**:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "python3 validate_prompt.py"
      }]
    }]
  }
}
```


### 2. PreToolUse Hook - Il Game Changer

**Attivazione**: Prima di qualsiasi esecuzione di tool [^1].

**Payload disponibile**: `tool_name`, `tool_input` (parametri completi)

**Controllo del flusso**: Può **bloccare** l'operazione con exit code 2

**Esempio di sicurezza**:

```json
{
  "matcher": "Bash",
  "hooks": [{
    "command": "if [[ \"$CLAUDE_TOOL_INPUT\" == *\"rm -rf\"* ]]; then exit 2; fi"
  }]
}
```


### 3. PostToolUse Hook - Automazione Post-Esecuzione

**Attivazione**: Dopo il completamento **riuscito** di un tool [^4].

**Payload disponibile**: `tool_name`, `tool_input`, `tool_response` con risultati

**Casi d'uso**:

- Auto-formattazione del codice dopo modifiche
- Esecuzione automatica di test
- Commit automatico delle modifiche


### 4. Notification Hook

**Attivazione**: Quando Claude invia notifiche (richieste di input, attese) [^4].

**Implementazione desktop**:

```bash
notify-send 'Claude Code' 'Awaiting your input'
```


### 5. Stop Hook

**Attivazione**: Quando Claude termina di rispondere [^4].

**Payload**: `stop_hook_active` (boolean)

**Utilizzo**: Generazione automatica di messaggi di completamento, TTS, logging di sessione.

### 6. SubagentStop Hook

**Attivazione**: Quando subagenti (Task tools) completano le operazioni [^4].

**Funzione**: Monitoraggio del completamento di task multi-agente.

### 7. PreCompact Hook

**Attivazione**: Prima delle operazioni di compattazione memoria [^4].

**Payload**: `trigger` ("manual"/"auto"), `custom_instructions`, session info

**Criticità**: Backup del transcript prima della riduzione della memoria.

### 8. SessionStart Hook

**Attivazione**: All'avvio di nuove sessioni o ripristino [^4].

**Payload**: `source` ("startup"/"resume"/"clear"), session info

**Utilizzo**: Caricamento automatico del contesto di sviluppo (git status, issue recenti).

## Sistema di Pattern Matcher Avanzato

### Matcher per Tool Specifici

```json
{
  "matcher": "Edit|Write|MultiEdit",
  "command": "auto-format.sh"
}
```


### Matcher per File Pattern

```json
{
  "matcher": {
    "file_paths": ["*.py", "src/**/*.ts"]
  }
}
```


### Matcher per Query Content

```json
{
  "matcher": {
    "query": "npm"
  }
}
```


## Implementazione di Trigger per Linguaggio Naturale

### Tool Automatico: claudecode-rule2hook

Il progetto `claudecode-rule2hook` trasforma **regole in linguaggio naturale** in hook automatici [^5]:

**Input naturale**:

- "Tutte le funzioni devono avere commenti"
- "I test devono coprire almeno l'80% del codice"
- "Il codice deve essere formattato secondo la style guide"

**Generazione automatica**:

```bash
claude generate --rules "All functions should have comments."
```


### Processamento NLP Integrato

```python
# Script per parsing di regole naturali
def parse_natural_rule(rule_text):
    # Estrae intent e parametri da linguaggio naturale
    if "formatting" in rule_text.lower():
        return generate_formatting_hook()
    elif "test" in rule_text.lower():
        return generate_testing_hook()
    # ... altre regole
```


## Variabili di Ambiente per Context Injection

### Variabili Standard Disponibili

- `$CLAUDE_PROJECT_DIR` - Directory del progetto corrente
- `$CLAUDE_FILE_PATHS` - File coinvolti nell'operazione
- `$CLAUDE_TOOL_INPUT` - Input del tool in formato JSON
- `$CLAUDE_TOOL_NAME` - Nome dello strumento utilizzato
- `$CLAUDE_SESSION_ID` - Identificatore univoco della sessione


### Esempio di Context Injection Dinamico

```bash
#!/bin/bash
# Hook che inietta contesto Git automatico
git_status=$(git status --porcelain 2>/dev/null)
recent_commits=$(git log --oneline -3 2>/dev/null)

echo "Git Status: $git_status" > /tmp/claude_context.json
echo "Recent Commits: $recent_commits" >> /tmp/claude_context.json
```


## Controllo del Flusso e Error Handling

### Codici di Uscita Speciali

- **Exit 0**: Successo, continua esecuzione normale
- **Exit 2**: **BLOCCA l'operazione**, mostra errore a Claude
- **Altri codici**: Errore non bloccante, continua esecuzione


### Pattern di Validazione Robusta

```python
#!/usr/bin/env python3
import json
import sys

try:
    data = json.load(sys.stdin)
    file_path = data.get('tool_input', {}).get('file_path', '')
    
    # Blocca modifiche a file critici
    if any(pattern in file_path for pattern in ['.env', '.git/', 'package-lock.json']):
        print(f"BLOCKED: Attempt to modify critical file {file_path}")
        sys.exit(2)
        
except Exception as e:
    print(f"Hook error: {e}")
    sys.exit(1)  # Errore non bloccante
```


## Implementazione di Observability Multi-Agente

### Sistema di Monitoring Completo

Il sistema di hook permette **osservabilità completa** dei comportamenti multi-agente [^6]:

```python
# send_event.py - Core observability
def send_event(event_type, payload):
    """Invia eventi a server di observability in tempo reale"""
    server_url = "http://localhost:3000/events"
    requests.post(server_url, json={
        "type": event_type,
        "payload": payload,
        "timestamp": time.time()
    })
```


### Dashboard Real-time

- **Database SQLite** con modalità WAL per accesso concorrente
- **WebSocket streaming** per aggiornamenti real-time
- **API REST** per recupero storico degli eventi
- **Filtraggio avanzato** per analisi specifiche

Il sistema di hook di Claude Code rappresenta la **convergenza perfetta** tra automazione deterministica e flessibilità AI, offrendo controllo granulare su ogni aspetto del workflow di sviluppo assistito [^3][^1].
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^7][^8][^9]</span>

```
<div style="text-align: center">⁂</div>
```

[^1]: https://dev.to/holasoymalva/the-ultimate-claude-code-guide-every-hidden-trick-hack-and-power-feature-you-need-to-know-2l45

[^2]: https://apidog.com/blog/claude-code-hooks/

[^3]: https://www.cometapi.com/claude-code-hooks-what-is-and-how-to-use-it/

[^4]: https://github.com/disler/claude-code-hooks-mastery

[^5]: https://github.com/astrodragonv/claudecode-rule2hook

[^6]: https://github.com/disler/claude-code-hooks-multi-agent-observability

[^7]: https://docs.claude.com/en/docs/claude-code/hooks

[^8]: https://hexdocs.pm/claude/guide-hooks.html

[^9]: https://www.anthropic.com/engineering/claude-code-best-practices

[^10]: https://dev.to/bredmond1019/mastering-claude-hooks-building-observable-ai-systems-part-2-2ic4

[^11]: https://docs.claude.com/en/docs/claude-code/hooks-guide

[^12]: https://www.builder.io/blog/claude-code

[^13]: https://github.com/ruvnet/claude-flow/issues/377

[^14]: https://www.siddharthbharath.com/claude-code-the-complete-guide/

[^15]: https://news.ycombinator.com/item?id=44429225

[^16]: https://www.youtube.com/watch?v=9ijnN985O_c

[^17]: https://www.devshorts.in/p/claude-code-the-complete-guide-for

[^18]: https://www.aiixx.ai/blog/claude-code-just-got-a-major-upgrade-slash-commands-and-hooks-are-here

[^19]: https://www.reddit.com/r/ClaudeAI/comments/1m280ek/game_changer_hook_setup_guide_covers_compact_read/

[^20]: https://www.reddit.com/r/ClaudeAI/comments/1loodjn/claude_code_now_supports_hooks/

<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Esempi Concreti di Hook per Context Injection e SQLite Memory

Ecco una guida pratica con esempi reali per ogni hook, focalizzata su **iniezione di contesto**, **recupero di memoria** e **salvataggio in database SQLite** durante sessioni di coding in Claude Code [^1][^2].

## 1. SessionStart Hook - Caricamento Contesto Iniziale

### Script di Inizializzazione del Contesto

```python
#!/usr/bin/env python3
# .claude/hooks/session_start.py
"""
Carica il contesto completo del progetto all'avvio della sessione
"""
import sqlite3
import json
import subprocess
import os
from datetime import datetime

def init_project_memory():
    # Connessione al database di memoria del progetto
    conn = sqlite3.connect('.claude/project_memory.db')
    cursor = conn.cursor()
    
    # Crea tabelle se non esistono
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS project_context (
            id INTEGER PRIMARY KEY,
            key TEXT UNIQUE,
            value TEXT,
            timestamp TEXT,
            session_id TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS code_patterns (
            id INTEGER PRIMARY KEY,
            pattern_type TEXT,
            description TEXT,
            code_snippet TEXT,
            usage_count INTEGER DEFAULT 0,
            last_used TEXT
        )
    ''')
    
    # Raccoglie contesto Git
    try:
        git_status = subprocess.check_output(['git', 'status', '--porcelain']).decode()
        git_branch = subprocess.check_output(['git', 'branch', '--show-current']).decode().strip()
        recent_commits = subprocess.check_output(['git', 'log', '--oneline', '-5']).decode()
        
        # Salva contesto Git
        session_id = datetime.now().isoformat()
        cursor.execute('INSERT OR REPLACE INTO project_context VALUES (?, ?, ?, ?, ?)',
                      (None, 'git_status', git_status, datetime.now().isoformat(), session_id))
        cursor.execute('INSERT OR REPLACE INTO project_context VALUES (?, ?, ?, ?, ?)',
                      (None, 'git_branch', git_branch, datetime.now().isoformat(), session_id))
        cursor.execute('INSERT OR REPLACE INTO project_context VALUES (?, ?, ?, ?, ?)',
                      (None, 'recent_commits', recent_commits, datetime.now().isoformat(), session_id))
    except:
        pass
    
    # Analizza struttura del progetto
    project_structure = {}
    for root, dirs, files in os.walk('.', topdown=True):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        if len(files) > 0:
            project_structure[root] = [f for f in files if not f.startswith('.')]
    
    cursor.execute('INSERT OR REPLACE INTO project_context VALUES (?, ?, ?, ?, ?)',
                  (None, 'project_structure', json.dumps(project_structure), datetime.now().isoformat(), session_id))
    
    # Carica pattern di codice precedenti
    cursor.execute('SELECT * FROM code_patterns ORDER BY usage_count DESC LIMIT 10')
    patterns = cursor.fetchall()
    
    conn.commit()
    conn.close()
    
    # Crea file di contesto per Claude
    with open('/tmp/claude_session_context.json', 'w') as f:
        json.dump({
            'git_branch': git_branch,
            'modified_files': git_status.split('\n') if git_status else [],
            'project_structure': project_structure,
            'frequent_patterns': [{'type': p[^1], 'desc': p[^2]} for p in patterns],
            'session_started': datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"✅ Session context loaded - Branch: {git_branch}, Modified files: {len(git_status.split()) if git_status else 0}")

if __name__ == "__main__":
    init_project_memory()
```


### Configurazione Hook

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "python3 .claude/hooks/session_start.py"
      }]
    }]
  }
}
```


## 2. UserPromptSubmit Hook - Analisi Prompt e Context Injection

### Script di Analisi del Prompt

```python
#!/usr/bin/env python3
# .claude/hooks/user_prompt_submit.py
"""
Analizza il prompt dell'utente e inietta contesto pertinente
"""
import sqlite3
import json
import sys
import re
from datetime import datetime

def analyze_and_inject_context():
    try:
        # Legge il prompt dall'input standard
        prompt_data = json.loads(sys.stdin.read())
        prompt_text = prompt_data.get('prompt', '')
        
        conn = sqlite3.connect('.claude/project_memory.db')
        cursor = conn.cursor()
        
        # Crea tabella per cronologia prompt
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS prompt_history (
                id INTEGER PRIMARY KEY,
                prompt_text TEXT,
                detected_intent TEXT,
                injected_context TEXT,
                timestamp TEXT
            )
        ''')
        
        # Rileva l'intent del prompt
        intent = detect_intent(prompt_text)
        context_to_inject = []
        
        # Inietta contesto basato sull'intent
        if 'debug' in intent or 'error' in intent or 'fix' in intent:
            # Recupera errori recenti e soluzioni
            cursor.execute('''
                SELECT value FROM project_context 
                WHERE key LIKE '%error%' OR key LIKE '%debug%'
                ORDER BY timestamp DESC LIMIT 5
            ''')
            error_context = cursor.fetchall()
            context_to_inject.extend([f"Recent errors: {err[^0][:100]}..." for err in error_context])
            
        elif 'test' in intent:
            # Inietta pattern di testing
            cursor.execute('''
                SELECT code_snippet FROM code_patterns 
                WHERE pattern_type = 'testing'
                ORDER BY usage_count DESC LIMIT 3
            ''')
            test_patterns = cursor.fetchall()
            context_to_inject.extend([f"Test pattern: {pattern[^0][:100]}..." for pattern in test_patterns])
            
        elif 'refactor' in intent or 'optimize' in intent:
            # Inietta pattern di refactoring
            cursor.execute('''
                SELECT description, code_snippet FROM code_patterns 
                WHERE pattern_type = 'refactoring'
                ORDER BY last_used DESC LIMIT 3
            ''')
            refactor_patterns = cursor.fetchall()
            context_to_inject.extend([f"Refactoring: {p[^0]} -> {p[^1][:50]}..." for p in refactor_patterns])
            
        elif 'implement' in intent or 'create' in intent or 'add' in intent:
            # Inietta standard di codifica e architettura
            cursor.execute('SELECT value FROM project_context WHERE key = "coding_standards"')
            standards = cursor.fetchone()
            if standards:
                context_to_inject.append(f"Coding standards: {standards[^0][:100]}...")
                
            # Inietta pattern architetturali
            cursor.execute('''
                SELECT description FROM code_patterns 
                WHERE pattern_type = 'architecture'
                ORDER BY usage_count DESC LIMIT 2
            ''')
            arch_patterns = cursor.fetchall()
            context_to_inject.extend([f"Architecture: {p[^0]}" for p in arch_patterns])
        
        # Salva nella cronologia
        cursor.execute('''
            INSERT INTO prompt_history (prompt_text, detected_intent, injected_context, timestamp)
            VALUES (?, ?, ?, ?)
        ''', (prompt_text[:500], json.dumps(intent), json.dumps(context_to_inject), datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        # Scrive il contesto iniettato in un file temporaneo
        if context_to_inject:
            with open('/tmp/claude_injected_context.txt', 'w') as f:
                f.write("=== INJECTED CONTEXT ===\n")
                for ctx in context_to_inject:
                    f.write(f"• {ctx}\n")
                f.write("========================\n")
            
            print(f"✅ Context injected: {len(context_to_inject)} items for intent: {intent}")
        
    except Exception as e:
        print(f"❌ Context injection failed: {e}")

def detect_intent(prompt_text):
    """Rileva l'intent del prompt usando pattern matching"""
    text_lower = prompt_text.lower()
    intents = []
    
    # Pattern per rilevare gli intent
    patterns = {
        'debug': ['debug', 'error', 'fix', 'bug', 'problem', 'issue', 'not working'],
        'test': ['test', 'testing', 'unit test', 'integration test', 'spec'],
        'refactor': ['refactor', 'optimize', 'improve', 'clean up', 'restructure'],
        'implement': ['implement', 'create', 'add', 'build', 'develop', 'write'],
        'analyze': ['analyze', 'review', 'check', 'examine', 'inspect'],
        'document': ['document', 'comment', 'readme', 'docs', 'documentation']
    }
    
    for intent, keywords in patterns.items():
        if any(keyword in text_lower for keyword in keywords):
            intents.append(intent)
    
    return intents if intents else ['general']

if __name__ == "__main__":
    analyze_and_inject_context()
```


## 3. PreToolUse Hook - Validazione e Context Injection Pre-Operazione

### Script di Validazione e Contesto Pre-Tool

```python
#!/usr/bin/env python3
# .claude/hooks/pre_tool_use.py
"""
Valida l'uso dei tool e inietta contesto specifico per l'operazione
"""
import sqlite3
import json
import os
import sys
from datetime import datetime

def pre_tool_validation():
    try:
        tool_input = os.environ.get('CLAUDE_TOOL_INPUT', '{}')
        tool_name = os.environ.get('CLAUDE_TOOL_NAME', '')
        
        tool_data = json.loads(tool_input)
        
        conn = sqlite3.connect('.claude/project_memory.db')
        cursor = conn.cursor()
        
        # Crea tabella per operazioni sui tool
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tool_operations (
                id INTEGER PRIMARY KEY,
                tool_name TEXT,
                operation_type TEXT,
                file_path TEXT,
                context_provided TEXT,
                timestamp TEXT,
                success BOOLEAN
            )
        ''')
        
        context_provided = []
        
        # Context injection specifico per tipo di tool
        if tool_name == 'Edit' or tool_name == 'Write':
            file_path = tool_data.get('file_path', '')
            
            # Inietta standard di formattazione per il tipo di file
            file_ext = os.path.splitext(file_path)[^1]
            cursor.execute('''
                SELECT value FROM project_context 
                WHERE key = ? 
                ORDER BY timestamp DESC LIMIT 1
            ''', (f'formatting_rules_{file_ext}',))
            
            formatting_rules = cursor.fetchone()
            if formatting_rules:
                context_provided.append(f"Formatting rules for {file_ext}: {formatting_rules[^0]}")
            
            # Inietta pattern correlati per file simili
            cursor.execute('''
                SELECT code_snippet, description FROM code_patterns 
                WHERE pattern_type = ? 
                ORDER BY usage_count DESC LIMIT 3
            ''', (f'pattern_{file_ext}',))
            
            related_patterns = cursor.fetchall()
            for pattern in related_patterns:
                context_provided.append(f"Pattern: {pattern[^1]} -> {pattern[^0][:100]}...")
            
            # Controlla se il file è critico
            critical_files = ['.env', 'package.json', 'requirements.txt', 'Dockerfile']
            if any(cf in file_path for cf in critical_files):
                context_provided.append(f"⚠️ CRITICAL FILE: {file_path} - Use extra caution")
                
                # Log operazione critica
                cursor.execute('''
                    INSERT INTO tool_operations (tool_name, operation_type, file_path, context_provided, timestamp, success)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (tool_name, 'critical_file_edit', file_path, json.dumps(context_provided), datetime.now().isoformat(), None))
        
        elif tool_name == 'Bash':
            command = tool_data.get('command', '')
            
            # Validazioni di sicurezza
            dangerous_commands = ['rm -rf', 'sudo rm', 'format', 'del /s', '> /dev/null']
            if any(danger in command for danger in dangerous_commands):
                print("❌ BLOCKED: Dangerous command detected")
                cursor.execute('''
                    INSERT INTO tool_operations (tool_name, operation_type, file_path, context_provided, timestamp, success)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (tool_name, 'blocked_dangerous', command, "SECURITY_BLOCK", datetime.now().isoformat(), False))
                conn.commit()
                conn.close()
                sys.exit(2)  # Blocca l'operazione
            
            # Inietta variabili di ambiente del progetto
            cursor.execute('SELECT value FROM project_context WHERE key = "env_vars"')
            env_vars = cursor.fetchone()
            if env_vars:
                context_provided.append(f"Environment variables: {env_vars[^0]}")
            
            # Inietta comandi frequenti
            cursor.execute('''
                SELECT value FROM project_context 
                WHERE key LIKE 'frequent_command_%' 
                ORDER BY timestamp DESC LIMIT 5
            ''')
            frequent_commands = cursor.fetchall()
            context_provided.extend([f"Frequent: {cmd[^0]}" for cmd in frequent_commands])
        
        # Salva l'operazione nel database
        cursor.execute('''
            INSERT INTO tool_operations (tool_name, operation_type, file_path, context_provided, timestamp, success)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (tool_name, 'pre_execution', tool_data.get('file_path', ''), json.dumps(context_provided), datetime.now().isoformat(), None))
        
        conn.commit()
        conn.close()
        
        # Scrive il contesto per Claude
        if context_provided:
            with open('/tmp/claude_tool_context.txt', 'w') as f:
                f.write(f"=== CONTEXT FOR {tool_name} ===\n")
                for ctx in context_provided:
                    f.write(f"• {ctx}\n")
                f.write("=" * 30 + "\n")
            
            print(f"✅ Tool context provided: {len(context_provided)} items for {tool_name}")
        
    except Exception as e:
        print(f"❌ Pre-tool validation failed: {e}")

if __name__ == "__main__":
    pre_tool_validation()
```


## 4. PostToolUse Hook - Salvataggio Risultati e Pattern Learning

### Script di Post-Elaborazione

```python
#!/usr/bin/env python3
# .claude/hooks/post_tool_use.py
"""
Salva i risultati delle operazioni e apprende nuovi pattern
"""
import sqlite3
import json
import os
import sys
import re
from datetime import datetime

def post_tool_processing():
    try:
        tool_input = os.environ.get('CLAUDE_TOOL_INPUT', '{}')
        tool_name = os.environ.get('CLAUDE_TOOL_NAME', '')
        
        # Legge la risposta del tool dallo stdin
        tool_response = sys.stdin.read()
        tool_data = json.loads(tool_input)
        
        conn = sqlite3.connect('.claude/project_memory.db')
        cursor = conn.cursor()
        
        # Aggiorna il record dell'operazione
        cursor.execute('''
            UPDATE tool_operations 
            SET success = TRUE 
            WHERE tool_name = ? AND timestamp = (
                SELECT MAX(timestamp) FROM tool_operations WHERE tool_name = ?
            )
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^3][^4][^5][^6][^7][^8][^9]</span>

<div style="text-align: center">⁂</div>

[^1]: https://www.reddit.com/r/ClaudeAI/comments/1lwcek2/combining_claude_code_hooks_with_sqlite_memory_is/
[^2]: https://github.com/doobidoo/mcp-memory-service/wiki/Claude-Code-Memory-Awareness-Guide
[^3]: https://github.com/disler/claude-code-hooks-multi-agent-observability
[^4]: https://www.siddharthbharath.com/claude-code-the-complete-guide/
[^5]: https://hartenfeller.dev/blog/testing-claude-code
[^6]: https://milvus.io/ai-quick-reference/can-claude-code-interact-with-databases
[^7]: https://www.wisp.blog/blog/dependency-injection-in-react-a-practical-guide-for-real-apps
[^8]: https://milvus.io/ai-quick-reference/does-claude-code-remember-previous-inputs-across-sessions
[^9]: https://www.youtube.com/watch?v=1JDVrQr2pPc&vl=it
[^10]: https://www.testmanagement.com/blog/2023/07/dependency-injection-and-context-injection/
[^11]: https://stevekinney.com/courses/ai-development/claude-code-session-management
[^12]: https://www.youtube.com/watch?v=wxCCzo9dGj0
[^13]: https://www.robinwieruch.de/react-context-injection/
[^14]: https://www.reddit.com/r/ClaudeAI/comments/1lcjgtc/claude_code_is_awesome_but_memory_handling_still/
[^15]: https://github.com/ruvnet/claude-flow/wiki/Memory-System
[^16]: https://www.zartis.com/react-hooks-and-dependency-injection/
[^17]: https://docs.claude.com/en/docs/claude-code/memory
[^18]: https://www.claudemcp.com/servers/sqlite
[^19]: https://docs.reqnroll.net/latest/automation/context-injection.html
[^20]: https://docs.anthropic.com/it/docs/claude-code/hooks-guide```

<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Esempi Completi di Hook per Gestione Task Automatici in Claude Code

Ecco un sistema completo di hook per automatizzare la **creazione e gestione di task** (progetti, piani, roadmap, macrotask, microtask) attraverso tutte le fasi di una sessione di coding in Claude Code [^1][^2].

## 1. SessionStart Hook - Inizializzazione Progetto e Caricamento Roadmap

### Script di Avvio Sessione con Task Management

```python
#!/usr/bin/env python3
# .claude/hooks/session_start_tasks.py
"""
Inizializza il sistema di task management e carica la roadmap del progetto
"""
import sqlite3
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

def initialize_task_management():
    try:
        # Inizializza database SQLite per task management
        conn = sqlite3.connect('.claude/project_tasks.db')
        cursor = conn.cursor()
        
        # Crea tabelle per gestione task gerarchici
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS roadmap_items (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'planned',
                estimated_hours INTEGER,
                phase TEXT,
                dependencies TEXT,
                created_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS macrotasks (
                id TEXT PRIMARY KEY,
                roadmap_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                acceptance_criteria TEXT,
                files_involved TEXT,
                implementation_steps TEXT,
                status TEXT DEFAULT 'planned',
                progress INTEGER DEFAULT 0,
                estimated_hours INTEGER,
                created_at TEXT,
                FOREIGN KEY (roadmap_id) REFERENCES roadmap_items (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS microtasks (
                id TEXT PRIMARY KEY,
                macrotask_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT,
                file_path TEXT,
                code_snippet TEXT,
                status TEXT DEFAULT 'todo',
                completed_at TEXT,
                estimated_minutes INTEGER,
                FOREIGN KEY (macrotask_id) REFERENCES macrotasks (id)
            )
        ''')
        
        # Rileva configurazione progetto esistente
        project_config = detect_project_structure()
        
        # Carica o crea progetto corrente
        project_id = f"project_{datetime.now().strftime('%Y%m%d')}"
        cursor.execute('''
            INSERT OR IGNORE INTO projects (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (project_id, project_config['name'], project_config['description'], 
              datetime.now().isoformat(), datetime.now().isoformat()))
        
        # Carica roadmap esistente da file
        roadmap_data = load_existing_roadmap()
        if roadmap_data:
            for item in roadmap_data:
                cursor.execute('''
                    INSERT OR REPLACE INTO roadmap_items 
                    (id, project_id, title, description, priority, status, phase, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (item['id'], project_id, item['title'], item['description'],
                      item.get('priority', 'medium'), item.get('status', 'planned'),
                      item.get('phase', 'development'), datetime.now().isoformat()))
        
        # Genera contesto di sessione per Claude
        session_context = {
            'project_id': project_id,
            'active_roadmap_items': get_active_roadmap_items(cursor),
            'pending_macrotasks': get_pending_macrotasks(cursor),
            'current_sprint': get_current_sprint_info(cursor),
            'project_structure': project_config,
            'session_started': datetime.now().isoformat()
        }
        
        # Salva contesto per Claude
        with open('/tmp/claude_task_context.json', 'w') as f:
            json.dump(session_context, f, indent=2)
        
        conn.commit()
        conn.close()
        
        print(f"✅ Task management initialized - Project: {project_config['name']}")
        print(f"📋 Active roadmap items: {len(session_context['active_roadmap_items'])}")
        print(f"🎯 Pending macrotasks: {len(session_context['pending_macrotasks'])}")
        
    except Exception as e:
        print(f"❌ Task management initialization failed: {e}")

def detect_project_structure():
    """Rileva la struttura e configurazione del progetto"""
    project_name = os.path.basename(os.getcwd())
    
    # Cerca file di configurazione
    config_files = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod']
    tech_stack = []
    
    for config_file in config_files:
        if os.path.exists(config_file):
            tech_stack.append(config_file.split('.')[^0])
    
    # Cerca file di documentazione esistenti
    docs = []
    doc_files = ['ROADMAP.md', 'README.md', 'CHANGELOG.md', 'TODO.md']
    for doc_file in doc_files:
        if os.path.exists(f'reference/{doc_file}') or os.path.exists(doc_file):
            docs.append(doc_file)
    
    return {
        'name': project_name,
        'description': f"Project {project_name} with {', '.join(tech_stack) if tech_stack else 'unknown tech stack'}",
        'tech_stack': tech_stack,
        'documentation': docs,
        'directory': os.getcwd()
    }

def load_existing_roadmap():
    """Carica roadmap esistente da file Markdown"""
    roadmap_paths = ['reference/ROADMAP.md', 'ROADMAP.md', 'docs/ROADMAP.md']
    
    for path in roadmap_paths:
        if os.path.exists(path):
            return parse_markdown_roadmap(path)
    
    return None

def parse_markdown_roadmap(filepath):
    """Parse roadmap da Markdown e converte in struttura dati"""
    roadmap_items = []
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Parsing semplice per task con checkbox
        lines = content.split('\n')
        current_phase = 'development'
        
        for line in lines:
            line = line.strip()
            
            # Rileva fasi
            if line.startswith('## ') or line.startswith('### '):
                current_phase = line.replace('#', '').strip().lower()
                continue
            
            # Rileva task items
            if '- [ ]' in line or '- [x]' in line or '- ✅' in line:
                status = 'completed' if '[x]' in line or '✅' in line else 'planned'
                title = line.replace('- [ ]', '').replace('- [x]', '').replace('- ✅', '').strip()
                
                if title:
                    roadmap_items.append({
                        'id': f"roadmap_{len(roadmap_items) + 1}",
                        'title': title[:100],
                        'description': title,
                        'status': status,
                        'phase': current_phase,
                        'priority': 'medium'
                    })
        
        return roadmap_items
    
    except Exception as e:
        print(f"Warning: Could not parse roadmap file {filepath}: {e}")
        return []

def get_active_roadmap_items(cursor):
    cursor.execute("SELECT * FROM roadmap_items WHERE status IN ('planned', 'in_progress')")
    return [dict(zip([col[^0] for col in cursor.description], row)) for row in cursor.fetchall()]

def get_pending_macrotasks(cursor):
    cursor.execute("SELECT * FROM macrotasks WHERE status IN ('planned', 'in_progress')")
    return [dict(zip([col[^0] for col in cursor.description], row)) for row in cursor.fetchall()]

def get_current_sprint_info(cursor):
    # Simula informazioni sprint
    return {
        'sprint_number': 1,
        'start_date': datetime.now().isoformat(),
        'focus': 'Core features development'
    }

if __name__ == "__main__":
    initialize_task_management()
```


## 2. UserPromptSubmit Hook - Riconoscimento Intent e Auto-Generazione Task

### Script di Analisi Prompt per Task Creation

```python
#!/usr/bin/env python3
# .claude/hooks/user_prompt_task_detector.py
"""
Analizza i prompt utente e crea automaticamente task quando rileva intent di pianificazione
"""
import sqlite3
import json
import sys
import re
from datetime import datetime
import uuid

def analyze_prompt_for_task_creation():
    try:
        # Legge il prompt dall'input
        prompt_data = json.loads(sys.stdin.read())
        prompt_text = prompt_data.get('prompt', '')
        
        # Rileva intent di task management
        task_intent = detect_task_creation_intent(prompt_text)
        
        if not task_intent['detected']:
            return
        
        conn = sqlite3.connect('.claude/project_tasks.db')
        cursor = conn.cursor()
        
        # Auto-creazione task basata sull'intent
        if task_intent['type'] == 'roadmap':
            create_roadmap_item(cursor, prompt_text, task_intent)
        elif task_intent['type'] == 'macrotask':
            create_macrotask(cursor, prompt_text, task_intent)
        elif task_intent['type'] == 'feature':
            create_feature_breakdown(cursor, prompt_text, task_intent)
        elif task_intent['type'] == 'refactor':
            create_refactoring_task(cursor, prompt_text, task_intent)
        
        # Inietta contesto task pertinente
        inject_relevant_task_context(cursor, task_intent)
        
        conn.commit()
        conn.close()
        
        print(f"✅ Auto-created {task_intent['type']}: {task_intent['title'][:50]}...")
        
    except Exception as e:
        print(f"❌ Task detection failed: {e}")

def detect_task_creation_intent(prompt_text):
    """Rileva se il prompt richiede creazione di task"""
    text_lower = prompt_text.lower()
    
    # Pattern per diversi tipi di task intent
    patterns = {
        'roadmap': {
            'keywords': ['roadmap', 'plan', 'planning', 'strategy', 'phases', 'milestones'],
            'phrases': ['create a roadmap', 'plan the project', 'development phases', 'project strategy']
        },
        'macrotask': {
            'keywords': ['implement', 'build', 'create', 'develop', 'add feature'],
            'phrases': ['implement feature', 'build component', 'create module', 'add functionality']
        },
        'feature': {
            'keywords': ['feature', 'functionality', 'capability', 'enhancement'],
            'phrases': ['new feature', 'add feature', 'feature request', 'enhance with']
        },
        'refactor': {
            'keywords': ['refactor', 'optimize', 'improve', 'restructure', 'clean up'],
            'phrases': ['refactor code', 'optimize performance', 'improve structure']
        }
    }
    
    for intent_type, config in patterns.items():
        # Controlla keywords
        keyword_matches = sum(1 for keyword in config['keywords'] if keyword in text_lower)
        phrase_matches = sum(1 for phrase in config['phrases'] if phrase in text_lower)
        
        if keyword_matches >= 2 or phrase_matches >= 1:
            title = extract_task_title(prompt_text, intent_type)
            return {
                'detected': True,
                'type': intent_type,
                'title': title,
                'confidence': (keyword_matches + phrase_matches * 2) / (len(config['keywords']) + len(config['phrases'])),
                'original_prompt': prompt_text
            }
    
    return {'detected': False}

def extract_task_title(prompt_text, intent_type):
    """Estrae un titolo appropriato dal prompt"""
    # Cerca pattern di titoli comuni
    title_patterns = [
        r'"([^"]+)"',  # Testo tra virgolette
        r'implement (.+?)(?:\.|$)',
        r'create (.+?)(?:\.|$)',
        r'build (.+?)(?:\.|$)',
        r'add (.+?)(?:\.|$)'
    ]
    
    for pattern in title_patterns:
        match = re.search(pattern, prompt_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()[:100]
    
    # Fallback: usa le prime parole significative
    words = prompt_text.split()
    significant_words = [w for w in words if len(w) > 3 and w.lower() not in ['the', 'and', 'for', 'with']]
    return ' '.join(significant_words[:8])

def create_roadmap_item(cursor, prompt_text, task_intent):
    """Crea un item della roadmap"""
    roadmap_id = f"roadmap_{uuid.uuid4().hex[:8]}"
    
    cursor.execute('''
        INSERT INTO roadmap_items 
        (id, project_id, title, description, priority, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        roadmap_id,
        'project_current',
        task_intent['title'],
        prompt_text[:500],
        'high' if 'urgent' in prompt_text.lower() else 'medium',
        'planned',
        datetime.now().isoformat()
    ))
    
    return roadmap_id

def create_macrotask(cursor, prompt_text, task_intent):
    """Crea un macrotask con breakdown automatico"""
    macrotask_id = f"macro_{uuid.uuid4().hex[:8]}"
    
    # Trova roadmap item correlato
    cursor.execute("SELECT id FROM roadmap_items WHERE status = 'in_progress' LIMIT 1")
    roadmap_result = cursor.fetchone()
    roadmap_id = roadmap_result[^0] if roadmap_result else None
    
    # Auto-genera steps di implementazione
    implementation_steps = generate_implementation_steps(prompt_text, task_intent['type'])
    
    cursor.execute('''
        INSERT INTO macrotasks 
        (id, roadmap_id, title, description, implementation_steps, status, estimated_hours, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        macrotask_id,
        roadmap_id,
        task_intent['title'],
        prompt_text[:500],
        json.dumps(implementation_steps),
        'planned',
        estimate_task_hours(implementation_steps),
        datetime.now().isoformat()
    ))
    
    # Crea microtask automatici
    create_automatic_microtasks(cursor, macrotask_id, implementation_steps)
    
    return macrotask_id

def create_feature_breakdown(cursor, prompt_text, task_intent):
    """Crea breakdown completo di una feature"""
    macrotask_id = create_macrotask(cursor, prompt_text, task_intent)
    
    # Analizza feature requirements
    feature_analysis = analyze_feature_requirements(prompt_text)
    
    # Aggiorna macrotask con analisi dettagliata
    cursor.execute('''
        UPDATE macrotasks 
        SET acceptance_criteria = ?, files_involved = ?
        WHERE id = ?
    ''', (
        json.dumps(feature_analysis['acceptance_criteria']),
        json.dumps(feature_analysis['files_involved']),
        macrotask_id
    ))

def generate_implementation_steps(prompt_text, task_type):
    """Genera steps di implementazione automatici"""
    base_steps = {
        'macrotask': [
            'Analyze requirements and existing code',
            'Design component/module architecture', 
            'Implement core functionality',
            'Add error handling and validation',
            'Write unit tests',
            'Update documentation'
        ],
        'feature': [
            'Research and plan feature specifications',
            'Create UI/UX mockups if needed',
            'Implement backend logic',
            'Implement frontend components',
            'Integration testing',
            'User acceptance testing'
        ],
        'refactor': [
            'Audit existing code',
            'Identify refactoring opportunities',
            'Create refactoring plan',
            'Implement changes incrementally',
            'Run regression tests',
            'Performance validation'
        ]
    }
    
    return base_steps.get(task_type, base_steps['macrotask'])

def create_automatic_microtasks(cursor, macrotask_id, implementation_steps):
    """Crea microtask automatici dai step di implementazione"""
    for i, step in enumerate(implementation_steps):
        microtask_id = f"micro_{uuid.uuid4().hex[:8]}"
        
        cursor.execute('''
            INSERT INTO microtasks 
            (id, macrotask_id, title, description, type, status, estimated_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            microtask_id,
            macrotask_id,
            f"Step {i+1}: {step}",
            step,
            categorize_step_type(step),
            'todo',
            estimate_step_minutes(step)
        ))

def categorize_step_type(step):
    """Categorizza il tipo di step"""
    step_lower = step.lower()
    
    if any(word in step_lower for word in ['test', 'testing']):
        return 'testing'
    elif any(word in step_lower for word in ['design', 'architecture', 'plan']):
        return 'planning'
    elif any(word in step_lower for word in ['implement', 'create', 'build']):
        return 'implementation'
    elif any(word in step_lower for word in ['document', 'documentation']):
        return 'documentation'
    else:
        return 'general'

def estimate_step_minutes(step):
    """Stima i minuti necessari per uno step"""
    step_lower = step.lower()
    
    if 'test' in step_lower:
        return 90
    elif 'implement' in step_lower or 'create' in step_lower:
        return 120
    elif 'design' in step_lower or 'plan' in step_lower:
        return 60
    elif 'document' in step_lower:
        return 45
    else:
        return 75

def estimate_task_hours(implementation_steps):
    """Stima le ore totali del task"""
    total_minutes = sum(estimate_step_minutes(step) for step in implementation_steps)
    return max(1, round(total_minutes / 60))

def analyze_feature_requirements(prompt_text):
    """Analizza requirements della feature dal prompt"""
    # Analisi semplificata
    return {
        'acceptance_criteria': [
            'Feature works as described',
            'All edge cases handled',
            'Tests pass',
            'Documentation updated'
        ],
        'files_involved': [
            'To be determined during implementation'
        ]
    }

def inject_relevant_task_context(cursor, task_intent):
    """Inietta contesto task pertinente per Claude"""
    # Recupera task correlati
    cursor.execute('''
        SELECT * FROM macrotasks 
        WHERE status IN ('in_progress', 'planned') 
        ORDER BY created_at DESC LIMIT 5
    ''')
    
    related_tasks = [dict(zip([col[^0] for col in cursor.description], row)) 
                    for row in cursor.fetchall()]
    
    # Crea contesto per Claude
    context = {
        'task_created': task_intent,
        'related_tasks': related_tasks,
        'next_actions': [
            'Review the auto-generated task breakdown',
            'Adjust implementation steps if needed',
            'Start with the first microtask'
        ]
    }
    
    with open('/tmp/claude_new_task_context.txt', 'w') as f:
        f.write(f"=== NEW TASK CREATED ===\n")
        f.write(f"Type: {task_intent['type'].upper()}\n")
        f.write(f"Title: {task_intent['title']}\n")
        f.write(f"Related tasks: {len(related_tasks)}\n")
        f.write("========================\n")

if __name__ == "__main__":
    analyze_prompt_for_task_creation()
```


## 3. PreToolUse Hook - Task Context Injection e Progress Tracking

### Script di Pre-Tool per Task Management

```python
#!/usr/bin/env python3
# .claude/hooks/pre_tool_task_context.py
"""
Inietta contesto task pertinente prima dell'uso di strumenti
"""
import sqlite3
import json
import os
from datetime import datetime

def inject_task_context_pre_tool():
    try:
        tool_input = os.environ.get('CLAUDE_TOOL_INPUT', '{}')
        tool_name = os.environ.get('CLAUDE_TOOL_NAME', '')
        
        tool_data = json.loads(tool_input)
        
        conn = sqlite3.connect('.claude/project_tasks.db')
        cursor = conn.cursor()
        
        context_injected = []
        
        # Context injection specifico per tipo di tool
        if tool_name in ['Edit', 'Write', 'MultiEdit']:
            file_path = tool_data.get('file_path', '')
            
            # Trova task correlati al file
            cursor.execute('''
                SELECT m.*, r.title as roadmap_title 
                FROM macrotasks m
                LEFT JOIN roadmap_items r ON m.roadmap_id = r.id
                WHERE m.files_involved LIKE ? OR m.description LIKE ?
                ORDER BY m.created_at DESC LIMIT 3
            ''', (f'%{file_path}%', f'%{file_path}%'))
            
            related_tasks = cursor.fetchall()
            
            if related_tasks:
                context_injected.append(f"📋 Related tasks for {file_path}:")
                for task in related_tasks:
                    context_injected.append(f"  • {task[^2]} (Status: {task[^7]}) - Progress: {task[^8]}%")
                    
                    # Recupera microtask per questo macrotask
                    cursor.execute('''
                        SELECT title, status FROM microtasks 
                        WHERE macrotask_id = ? AND status != 'completed'
                        ORDER BY created_at LIMIT 5
                    ''', (task[^0],))
                    
                    microtasks = cursor.fetchall()
                    for micro in microtasks:
                        context_injected.append(f"    - {micro[^0]} ({micro[^1]})")
            
            # Inietta acceptance criteria se disponibili
            cursor.execute('''
                SELECT acceptance_criteria FROM macrotasks 
                WHERE files_involved LIKE ? AND acceptance_criteria IS NOT NULL
                ORDER BY created_at DESC LIMIT 1
            ''', (f'%{file_path}%',))
            
            criteria_result = cursor.fetchone()
            if criteria_result and criteria_result[^0]:
                try:
                    criteria = json.loads(criteria_result[^0])
                    context_injected.append("✅ Acceptance Criteria:")
                    for criterion in criteria:
                        context_injected.append(f"  • {criterion}")
                except:
                    pass
        
        elif tool_name == 'Bash':
            command = tool_data.get('command', '')
            
            # Rileva se il comando è correlato a task (es. testing, building)
            if any(keyword in command.lower() for keyword in ['test', 'build', 'deploy', 'run']):
                cursor.execute('''
                    SELECT title, status FROM microtasks 
                    WHERE type = 'testing' AND status != 'completed'
                    ORDER BY created_at LIMIT 3
                ''')
                
                testing_tasks = cursor.fetchall()
                if testing_tasks:
                    context_injected.append("🧪 Active Testing Tasks:")
                    for task in testing_tasks:
                        context_injected.append(f"  • {task[^0]} ({task[^1]})")
        
        # Aggiorna log delle operazioni
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tool_operations_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_name TEXT,
                file_path TEXT,
                operation_type TEXT,
                related_tasks TEXT,
                timestamp TEXT
            )
        ''')
        
        cursor.execute('''
            INSERT INTO tool_operations_log 
            (tool_name, file_path, operation_type, related_tasks, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            tool_name,
            tool_data.get('file_path', ''),
            'pre_execution',
            json.dumps([t[^0] for t in related_tasks]) if 'related_tasks' in locals() else '[]',
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        # Scrive contesto per Claude
        if context_injected:
            with open('/tmp/claude_task_tool_context.txt', 'w') as f:
                f.write("=== TASK CONTEXT FOR OPERATION ===\n")
                for item in context_injected:
                    f.write(f"{item}\n")
                f.write("===================================\n")
            
            print(f"✅ Task context injected for {tool_name}: {len(context_injected)} items")
        
    except Exception as e:
        print(f"❌ Task context injection failed: {e}")

if __name__ == "__main__":
    inject_task_context_pre_tool()
```


## 4. PostToolUse Hook - Automatic Progress Tracking e Microtask Completion

### Script di Post-Tool per Progress Tracking

```python
#!/usr/bin/env python3
# .claude/hooks/post_tool_progress_tracker.py
"""
Traccia automaticamente il progresso e marca microtask come completati
"""
import sqlite3
import json
import os
import sys
from datetime import datetime
import re

def track_progress_and_complete_microtasks():
    try:
        tool_input = os.environ.get('CLAUDE_TOOL_INPUT', '{}')
        tool_name = os.environ.get('CLAUDE_TOOL_NAME', '')
        
        # Legge la risposta del tool
        tool_response = sys.stdin.read()
        tool_data = json.loads(tool_input)
        
        conn = sqlite3.connect('.claude/project_tasks.db')
        cursor = conn.cursor()
        
        # Analizza l'operazione per identificare task completati
        completed_activities = analyze_completed_activities(tool_name, tool_data, tool_response)
        
        for activity in completed_activities:
            # Cerca microtask corrispondenti
            matching_microtasks = find_matching_microtasks(cursor, activity)
            
            for microtask in matching_microtasks:
                mark_microtask_completed(cursor, microtask, activity)
                update_macrotask_progress(cursor, microtask['macrotask_id'])
        
        # Log dell'operazione
        log_tool_operation(cursor, tool_name, tool_data, completed_activities)
        
        # Genera suggerimenti per i prossimi step
        next_steps = suggest_next_steps(cursor)
        
        conn.commit()
        conn.close()
        
        if completed_activities:
            print(f"✅ Progress updated: {len(completed_activities)} activities completed")
            
        if next_steps:
            print(f"➡️  Next suggested steps: {len(next_steps)}")
            with open('/tmp/claude_next_steps.txt', 'w') as f:
                f.write("=== SUGGESTED NEXT STEPS ===\n")
                for step in next_steps:
                    f.write(f"• {step['title']} (Est: {step['estimated_minutes']}min)\n")
                f.write("============================\n")
        
    except Exception as e:
        print(f"❌ Progress tracking failed: {e}")

def analyze_completed_activities(tool_name, tool_data, tool_response):
    """Analizza le attività completate dall'operazione del tool"""
    activities = []
    
    if tool_name in ['Edit', 'Write']:
        file_path = tool_data.get('file_path', '')
        content = tool_data.get('content', '')
        
        # Analizza il tipo di modifica
        if 'function' in content.lower() or 'def ' in content or 'function ' in content:
            activities.append({
                'type': 'function_implementation',
                'description': f'Implemented function in {file_path}',
                'file_path': file_path,
                'keywords': ['implement', 'function', 'method']
            })
        
        if 'test' in file_path.lower() or 'spec' in file_path.lower():
            activities.append({
                'type': 'test_implementation',
                'description': f'Added tests in {file_path}',
                'file_path': file_path,
                'keywords': ['test', 'testing', 'unit test']
            })
        
        if 'component' in content.lower() or 'import react' in content.lower():
            activities.append({
                'type': 'component_implementation',
                'description': f'Implemented component in {file_path}',
                'file_path': file_path,
                'keywords': ['component', 'ui', 'interface']
            })
        
        if 'README' in file_path or 'doc' in file_path.lower():
            activities.append({
                'type': 'documentation',
                'description': f'Updated documentation in {file_path}',
                'file_path': file_path,
                'keywords': ['document', 'readme', 'docs']
            })
    
    elif tool_name == 'Bash':
        command = tool_data.get('command', '')
        
        if 'test' in command.lower():
            activities.append({
                'type': 'test_execution',
                'description': f'Executed tests: {command}',
                'keywords': ['test', 'testing']
            })
        
        if any(keyword in command.lower() for keyword in ['build', 'compile', 'make']):
            activities.append({
                'type': 'build_execution',
                'description': f'Built project: {command}',
                'keywords': ['build', 'compile']
            })
        
        if 'git' in command.lower() and 'commit' in command.lower():
            activities.append({
                'type': 'version_control',
                'description': f'Version control operation: {command}',
                'keywords': ['git', 'commit', 'version']
            })
    
    return activities

def find_matching_microtasks(cursor, activity):
    """Trova microtask che corrispondono all'attività completata"""
    # Cerca per keywords nella descrizione
    keyword_conditions = []
    params = []
    
    for keyword in activity['keywords']:
        keyword_conditions.append("(title LIKE ? OR description LIKE ?)")
        params.extend([f'%{keyword}%', f'%{keyword}%'])
    
    # Cerca anche per file path se disponibile
    if 'file_path' in activity:
        keyword_conditions.append("description LIKE ?")
        params.append(f"%{activity['file_path']}%")
    
    query = f'''
        SELECT * FROM microtasks 
        WHERE status = 'todo' AND ({' OR '.join(keyword_conditions)})
        ORDER BY created_at ASC
        LIMIT 3
    '''
    
    cursor.execute(query, params)
    columns = [description[^0] for description in cursor.description]
    
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

def mark_microtask_completed(cursor, microtask, activity):
    """Marca un microtask come completato"""
    cursor.execute('''
        UPDATE microtasks 
        SET status = 'completed', completed_at = ?
        WHERE id = ?
    ''', (datetime.now().isoformat(), microtask['id']))
    
    print(f"✅ Completed microtask: {microtask['title']}")

def update_macrotask_progress(cursor, macrotask_id):
    """Aggiorna il progresso del macrotask basato sui microtask completati"""
    # Conta microtask totali e completati
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM microtasks 
        WHERE macrotask_id = ?
    ''', (macrotask_id,))
    
    result = cursor.fetchone()
    total, completed = result
    
    if total > 0:
        progress = int((completed / total) * 100)
        
        # Determina nuovo status del macrotask
        if progress == 100:
            new_status = 'completed'
        elif progress > 0:
            new_status = 'in_progress'
        else:
            new_status = 'planned'
        
        cursor.execute('''
            UPDATE macrotasks 
            SET progress = ?, status = ?
            WHERE id = ?
        ''', (progress, new_status, macrotask_id))
        
        print(f"📊 Macrotask progress updated: {progress}% ({new_status})")

def suggest_next_steps(cursor):
    """Suggerisce i prossimi step basati sui microtask disponibili"""
    cursor.execute('''
        SELECT m.title, m.estimated_minutes, mt.title as macrotask_title
        FROM microtasks m
        JOIN macrotasks mt ON m.macrotask_id = mt.id
        WHERE m.status = 'todo'
        ORDER BY mt.created_at ASC, m.id ASC
        LIMIT 5
    ''')
    
    return [
        {
            'title': row[^0],
            'estimated_minutes': row[^1] or 60,
            'macrotask': row[^2]
        }
        for row in cursor.fetchall()
    ]

def log_tool_operation(cursor, tool_name, tool_data, completed_activities):
    """Registra l'operazione del tool nel log"""
    cursor.execute('''
        INSERT INTO tool_operations_log 
        (tool_name, file_path, operation_type, related_tasks, timestamp)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        tool_name,
        tool_data.get('file_path', ''),
        'post_execution',
        json.dumps([activity['description'] for activity in completed_activities]),
        datetime.now().isoformat()
    ))

if __name__ == "__main__":
    track_progress_and_complete_microtasks()
```


## 5. Stop Hook - Session Summary e Task Reporting

### Script di Fine Sessione per Task Summary

```python
#!/usr/bin/env python3
# .claude/hooks/stop_session_task_summary.py
"""
Genera summary della sessione e report sui task completati
"""
import sqlite3
import json
from datetime import datetime, timedelta

def generate_session_task_summary():
    try:
        conn = sqlite3.connect('.claude/project_tasks.db')
        cursor = conn.cursor()
        
        # Recupera attività della sessione (ultima ora)
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        
        # Task completati nella sessione
        cursor.execute('''
            SELECT * FROM microtasks 
            WHERE completed_at > ? 
            ORDER BY completed_at DESC
        ''', (one_hour_ago,))
        
        completed_microtasks = cursor.fetchall()
        
        # Macrotask con progresso aggiornato
        cursor.execute('''
            SELECT m.*, r.title as roadmap_title
            FROM macrotasks m
            LEFT JOIN roadmap_items r ON m.roadmap_id = r.id
            WHERE m.status = 'in_progress' OR (
                SELECT COUNT(*) FROM microtasks 
                WHERE macrotask_id = m.id AND completed_at > ?
            ) > 0
            ORDER BY m.progress DESC
        ''', (one_hour_ago,))
        
        active_macrotasks = cursor.fetchall()
        
        # Genera summary
        summary = {
            'session_date': datetime.now().isoformat(),
            'completed_microtasks': len(completed_microtasks),
            'active_macrotasks': len(active_macrotasks),
            'completion_details': []
        }
        
        # Dettagli completamenti
        for task in completed_microtasks:
            summary['completion_details'].append({
                'title': task[^2],  # title field
                'completed_at': task[^8],  # completed_at field
                'type': task[^5]  # type field
            })
        
        # Calcola metriche di progresso
        if active_macrotasks:
            total_progress = sum(task[^8] or 0 for task in active_macrotasks)  # progress field
            avg_progress = total_progress / len(active_macrotasks)
            summary['average_progress'] = round(avg_progress, 1)
        else:
            summary['average_progress'] = 0
        
        # Salva summary
        with open('/tmp/claude_session_summary.json', 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Genera report testuale
        report_lines = [
            "=== SESSION TASK SUMMARY ===",
            f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            f"",
            f"✅ Completed microtasks: {len(completed_microtasks)}",
            f"🔄 Active macrotasks: {len(active_macrotasks)}",
            f"📊 Average progress: {summary['average_progress']}%",
            f""
        ]
        
        if completed_microtasks:
            report_lines.append("📋 Completed This Session:")
            for task in completed_microtasks:
                report_lines.append(f"  • {task[^2]} ({task[^5]})")
        
        if active_macrotasks:
            report_lines.append("\n🎯 Active Macrotasks:")
            for task in active_macrotasks:
                progress = task[^8] or 0
                report_lines.append(f"  • {task[^2]} - {progress}% ({task[^7]})")
        
        # Suggerimenti per la prossima sessione
        cursor.execute('''
            SELECT title, estimated_minutes FROM microtasks 
            WHERE status = 'todo'
            ORDER BY created_at ASC LIMIT 3
        ''')
        
        next_tasks = cursor.fetchall()
        if next_tasks:
            report_lines.append("\n➡️  Suggested for next session:")
            for task in next_tasks:
                report_lines.append(f"  • {task[^0]} (Est: {task[^1] or 60}min)")
        
        report_lines.append("=" * 30)
        
        # Salva report
        with open('/tmp/claude_task_report.txt', 'w') as f:
            f.write('\n'.join(report_lines))
        
        conn.close()
        
        print(f"✅ Session summary generated: {len(completed_microtasks)} completed, {len(active_macrotasks)} active")
        
        # Mostra summary breve
        if completed_microtasks:
            print("🎉 Achievements this session:")
            for task in completed_microtasks[:3]:
                print(f"  • {task[^2]}")
        
    except Exception as e:
        print(f"❌ Session summary generation failed: {e}")

if __name__ == "__main__":
    generate_session_task_summary()
```


## 6. Configurazione Completa Hook Sistema Task Management

### File .claude/settings.json

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command", 
        "command": "python3 .claude/hooks/session_start_tasks.py"
      }]
    }],
    
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "python3 .claude/hooks/user_prompt_task_detector.py"
      }]
    }],
    
    "PreToolUse": [{
      "matcher": "Edit|Write|MultiEdit|Bash",
      "hooks": [{
        "type": "command",
        "command": "python3 .claude/hooks/pre_tool_task_context.py"
      }]
    }],
    
    "PostToolUse": [{
      "matcher": "Edit|Write|MultiEdit|Bash", 
      "hooks": [{
        "type": "command",
        "command": "python3 .claude/hooks/post_tool_progress_tracker.py"
      }]
    }],
    
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "python3 .claude/hooks/stop_session_task_summary.py"
      }]
    }]
  }
}
```

Questo sistema di hook crea un **framework completo di task management automatico** per Claude Code, trasformando ogni sessione di coding in un **workflow strutturato e tracciabile** con gestione gerarchica di progetti, roadmap, macrotask e microtask [^3][^1].
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^4][^6][^9]</span>

```
<div style="text-align: center">⁂</div>
```

[^1]: https://github.com/ruvnet/claude-flow/wiki/Hooks-System

[^2]: https://thegroundtruth.substack.com/p/my-claude-code-workflow-and-personal-tips

[^3]: https://www.eesel.ai/blog/claude-code-automation

[^4]: https://blog.gitbutler.com/automate-your-ai-workflows-with-claude-code-hooks

[^5]: https://www.reddit.com/r/ClaudeAI/comments/1ls64yu/i_built_a_hook_that_gives_claude_code_automatic/

[^6]: https://www.arsturn.com/blog/a-beginners-guide-to-using-subagents-and-hooks-in-claude-code

[^7]: https://www.linkedin.com/posts/lewisowain_how-to-master-claude-code-hooks-activity-7351573925132206082-8jnp

[^8]: https://scuti.asia/intelligent-automation-with-claude-code-hooks-a-new-leap-in-software-development/

[^9]: https://www.claudelog.com/mechanics/hooks/

[^10]: https://www.reddit.com/r/ClaudeAI/comments/1loodjn/claude_code_now_supports_hooks/

[^11]: https://www.sidetool.co/post/how-to-automate-tasks-with-claude-code-workflow-for-developers

[^12]: https://dev.to/holasoymalva/the-ultimate-claude-code-guide-every-hidden-trick-hack-and-power-feature-you-need-to-know-2l45

[^13]: https://www.siddharthbharath.com/claude-code-the-complete-guide/

[^14]: https://www.anthropic.com/engineering/claude-code-best-practices

[^15]: https://www.paulmduvall.com/claude-code-advanced-tips-using-commands-configuration-and-hooks/

[^16]: https://github.com/hesreallyhim/awesome-claude-code

[^17]: https://github.com/anthropics/claude-code/issues/3447

[^18]: https://www.youtube.com/watch?v=8T0kFSseB58

[^19]: https://hexdocs.pm/claude/guide-hooks.html

