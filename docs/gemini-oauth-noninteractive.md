Gemini CLI OAuth (Non-Interactive) with DevFlow
================================================

Goal: Use Gemini CLI with personal OAuth in non-interactive mode (e.g., from MCP/Codex/CI) by completing a one-time OAuth on any machine and reusing the stored credentials.

Quick Summary
- Preferred auth order: API Key → ADC (service account) → OAuth personal (stored tokens).
- Non-interactive OAuth works only after the initial OAuth completes once.
- Gemini CLI persists tokens in either `~/.config/gemini/` (XDG) or `~/.gemini/`.

One-Time OAuth Setup
1) Local login, then copy credentials
   - Run locally: `gemini` → select “Login with Google” and finish OAuth in browser.
   - Copy the resulting directory to the target host:
     - `~/.config/gemini` OR `~/.gemini` (depending on your installation)
     - Example: `scp -r ~/.gemini user@remote:~/`

2) SSH port-forward (remote servers)
   - Start `gemini` on the remote server and note the callback port (e.g., `localhost:42761`).
   - From local: `ssh -L 42761:localhost:42761 user@server` and complete OAuth in your local browser.

3) Debug URL method
   - Run: `gemini --debug` and open the printed OAuth URL in a browser to complete auth.

Project Configuration (Optional)
- Create `.gemini/settings.json` in your project to hint the desired auth type:
```
{
  "selectedAuthType": "oauth-personal",
  "theme": "Default"
}
```
- You can also set `GEMINI_CONFIG_DIR` to point DevFlow to a specific config folder.

How DevFlow Detects OAuth Readiness
- DevFlow checks these locations for credentials/settings:
  - `$GEMINI_CONFIG_DIR`
  - `$XDG_CONFIG_HOME/gemini`
  - `~/.config/gemini`
  - `~/.gemini`
- If none are present and no `GEMINI_API_KEY` / `GOOGLE_API_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` is set, DevFlow will surface actionable guidance and skip Gemini for that run.

Non-Interactive Usage Examples
- From DevFlow wrapper: `devflow-gemini "Analyze this code"`
- Directly: `gemini -p "Analyze this code"`

Notes
- Tokens refresh automatically once initial OAuth succeeds.
- The CLI may store files like `settings.json`, `auth.json`, `oauth_creds.json`, or `auth/tokens.json` in the config directory.

