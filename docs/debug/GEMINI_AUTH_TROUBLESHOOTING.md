# Gemini CLI – Autenticazione: guida definitiva

Stato: stabile. Questo documento descrive una strategia robusta e
non‑interattiva per usare Gemini CLI all’interno di DevFlow, evitando gli
errori di tipo "The configured auth type is oauth-personal, but the current
auth type is undefined".

## Sintesi del problema
- L’installazione locale di Gemini CLI può essere configurata per
  `oauth-personal` (login Google interattivo). In modalità non interattiva
  questo causa errori/mancanza di token.
- In alcuni casi `settings.json` impone un `enforcedType` che entra in
  conflitto con l’ambiente (API key o ADC), generando mismatch.

## Cosa abbiamo implementato (DevFlow)
Nel wrapper `tools/cli/devflow-gemini.mjs`:
- Rilevamento automatico del tipo di auth desiderato:
  - API key se presenti `GEMINI_API_KEY` o `GOOGLE_API_KEY`.
  - Credenziali Google/ADC se presente `GOOGLE_APPLICATION_CREDENTIALS`.
  - Altrimenti `oauth-personal` (interattivo).
- Armonizzazione variabili: se è impostata una sola tra `GEMINI_API_KEY` e
  `GOOGLE_API_KEY`, la duplichiamo per massima compatibilità.
- Messaggi d’errore chiari e azionabili per mismatch di auth, con exit code
  `2` per distinguere i casi di autenticazione.

Questo riduce i casi di failure transitori e rende la CLI utilizzabile in modo
non interattivo quando possibile.

## Percorsi di autenticazione consigliati (non interattivi)

1) API Key (AI Studio / Vertex)
- Esportare la chiave in entrambe le variabili:
  ```bash
  export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
  export GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
  ```
- Facoltativo: renderla persistente in `~/.gemini/.env`:
  ```bash
  mkdir -p ~/.gemini
  cat >> ~/.gemini/.env <<'EOF'
  GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
  GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
  EOF
  ```

2) Google ADC / Service Account
- Con service account JSON:
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
  ```
- Oppure con ADC locale:
  ```bash
  gcloud auth application-default login
  ```

## Se l’ambiente impone oauth-personal
Se `~/.config/gemini/settings.json` impone `oauth-personal` (o un
`enforcedType`), in modalità non interattiva avrai errori. Opzioni:
- Allineare i setting a `api_key` rimuovendo l’enforcement, ad es. nel file:
  ```json
  {
    "security": {
      "auth": {
        "selectedType": "api_key",
        "enforcedType": null
      }
    }
  }
  ```
- Oppure eseguire una volta l’autenticazione interattiva: avvia `gemini`, poi
  usa `/auth` e completa il login. Dopo la riuscita, i token saranno presenti.

## Verifiche rapide
- Controllo variabili d’ambiente:
  ```bash
  env | grep -E "GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_APPLICATION_CREDENTIALS"
  ```
- Controllo impostazioni (se presente):
  ```bash
  sed -n '1,120p' ~/.config/gemini/settings.json
  ```

## Errori comuni e risoluzioni
- "configured auth type is oauth ... current auth type is undefined":
  - Passa ad API key o ADC (vedi sopra) o esegui login interattivo via
    `gemini` → `/auth`.
  - Se c’è `enforcedType`, rimuovilo o allinealo all’ambiente non interattivo.
- "re-authenticate with the correct type":
  - Le variabili/setting non corrispondono al metodo richiesto. Uniforma a
    API key (duplica in entrambe le var) o configura ADC.

## Riferimenti utili (Gemini CLI)
- Autenticazione (API key, ADC, oauth)
- Configurazione `settings.json` (security/auth, tools, sandbox)
- Comandi non interattivi (`--prompt`)

Nota: i riferimenti derivano dalla documentazione pubblica del progetto
Gemini CLI e sono stati usati per definire questa procedura.

