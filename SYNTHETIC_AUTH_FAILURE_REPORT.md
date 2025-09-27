# Report di Analisi: Fallimento Autenticazione MCP Synthetic

## 1. Descrizione della Criticità

Il sistema DevFlow non è in grado di eseguire alcuna operazione che dipenda dalla piattaforma `Synthetic.new`. Qualsiasi tentativo di utilizzare uno strumento che viene instradato al server MCP `synthetic` (es. `synthetic_auto_file`) fallisce sistematicamente con un errore **HTTP 401 Unauthorized**.

Questo indica che le chiamate API dirette dal server MCP locale verso l'infrastruttura esterna di `Synthetic.new` vengono respinte a causa di una chiave API non valida o mancante.

L'impatto è critico, poiché blocca tutte le funzionalità di generazione codice, prototipazione rapida e debugging che sono state delegate a questo modello, come definito nella configurazione del progetto.

## 2. Riepilogo dei Tentativi di Correzione (Senza Successo)

Di seguito la cronologia degli interventi effettuati nel tentativo di risolvere il problema:

1.  **Test Iniziale:**
    *   **Azione:** È stato eseguito un test per modificare un file temporaneo (`synthetic-test.txt`) tramite lo strumento `synthetic_auto_file`.
    *   **Risultato:** Fallimento immediato con errore `401 Unauthorized`.

2.  **Correzione dello Script di Avvio (`devflow-start.sh`):**
    *   **Ipotesi:** Si è ipotizzato che il server MCP `synthetic` non venisse avviato correttamente come servizio persistente.
    *   **Azione:** È stata modificata la funzione `start_synthetic` nello script per avviare il server come un processo in background (`nohup`), in modo analogo agli altri servizi.
    *   **Invalidazione:** L'utente ha correttamente segnalato che il server `synthetic` è un server **stdio**, che non deve essere demonizzato ma viene eseguito "on-demand". La modifica è stata quindi annullata ripristinando lo script originale.

3.  **Correzione della Configurazione MCP (`claude-code-mcp-config.json`):**
    *   **Ipotesi:** Il problema risiede nel modo in cui le variabili d'ambiente vengono passate al processo `stdio` al momento della sua esecuzione.
    *   **Analisi:** Il file di configurazione conteneva un blocco `"env"` che specificava `"SYNTHETIC_API_KEY": "${SYNTHETIC_API_KEY}"`. Si è ipotizzato che questo passasse una stringa letterale invece del valore della variabile.
    *   **Azione:** Il blocco `"env"` è stato rimosso dalla configurazione del server `devflow-synthetic-cc-sessions`, presumendo che il processo figlio avrebbe ereditato l'ambiente dal suo processo genitore (l'orchestratore).
    *   **Risultato:** Il problema è rimasto irrisolto. Il test successivo è stato interrotto dall'utente prima di poterne verificare l'esito, ma è chiaro che la soluzione non è stata trovata.

## 3. Analisi delle Probabili Cause Profonde

La causa principale è quasi certamente una **mancata propagazione della variabile d'ambiente `SYNTHETIC_API_KEY`**.

La catena di esecuzione è la seguente:
`Shell -> devflow-start.sh -> Processo Orchestratore/Bridge -> Processo stdio (synthetic)`

La variabile `SYNTHETIC_API_KEY`, correttamente definita nel file `.env` e esportata dallo script `devflow-start.sh`, si perde in uno dei passaggi successivi e non raggiunge la sua destinazione finale: il processo `stdio` che deve effettuare la chiamata API.

Le ipotesi più probabili sono:

1.  **Isolamento dell'Ambiente:** Il processo "Spawner" (l'Orchestratore/Bridge che legge `claude-code-mcp-config.json`) potrebbe essere progettato per non passare automaticamente le variabili d'ambiente ai processi figli per motivi di sicurezza. In questo caso, la rimozione del blocco `"env"` è anch'essa una mossa errata, perché non viene passato alcun ambiente.
2.  **Meccanismo di Sostituzione Fallito:** La sintassi `"${...}"` nel file di configurazione JSON è un chiaro indizio dell'intenzione di usare un meccanismo di sostituzione delle variabili. Questo meccanismo sta fallendo. Il componente "Spawner" potrebbe non supportare questa sintassi, o potrebbe aspettarsene una diversa.
3.  **Mancata Ereditarietà a Monte:** C'è una piccola possibilità che il processo Orchestratore/Bridge stesso non stia ereditando correttamente l'ambiente dallo script `devflow-start.sh` che lo lancia.

## 4. Suggerimento di Soluzione per il Team di Debug

L'indagine deve concentrarsi sul **componente software che funge da "Spawner" per i server MCP `stdio`**.

1.  **Identificare lo Spawner:** Il primo passo è individuare il codice sorgente (probabilmente nel servizio `orchestrator` o in un pacchetto `core`) che legge il file `claude-code-mcp-config.json` ed esegue il comando `node` per lanciare i server.

2.  **Verificare l'Ambiente del Parent:** Aggiungere log temporanei nel codice dello Spawner per stampare il suo stesso `process.env`. Questo confermerà se sta ereditando correttamente la `SYNTHETIC_API_KEY` dallo script `devflow-start.sh`.

3.  **Ispezionare la Creazione del Child Process:** Analizzare la chiamata a `child_process.spawn` (o equivalente). È fondamentale loggare l'oggetto `options` e in particolare la proprietà `env` che viene passata al processo figlio. Questo mostrerà esattamente con quale ambiente il server `stdio` viene creato.

4.  **Implementare la Correzione:**
    *   **Scenario A (Soluzione probabile):** Se lo Spawner ha la variabile nel suo ambiente ma non la passa, significa che il meccanismo di sostituzione (`"${...}"`) non funziona. La soluzione più robusta è modificare lo Spawner affinché, prima di lanciare il figlio, legga la configurazione, trovi i valori come `"${SYNTHETIC_API_KEY}"` e li sostituisca programmaticamente con i valori presi dal suo `process.env`.
    *   **Scenario B (Soluzione rapida):** Una soluzione temporanea ma efficace potrebbe essere quella di modificare lo Spawner per iniettare *sempre* la `SYNTHETIC_API_KEY` nell'ambiente del figlio, bypassando la configurazione `env` nel JSON.

Il focus deve essere sul ponte tra la configurazione JSON e l'effettiva esecuzione del processo figlio.
