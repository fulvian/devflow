# Smart Session Retry - Quick Start

## How to Use

1. **Start DevFlow services** (includes session retry system):
   ```bash
   ./devflow-start.sh
   ```

2. **Use Claude Code normally**:
   ```bash
   claude
   ```

3. **When you see a limit message** like:
   ```
   5-hour limit reached ∙ resets 3am
   ```

4. **Quickly notify the system** with the global alias:
   ```bash
   retry-claude
   ```
   Then just type: `3am` (and press Enter)

5. **The system will automatically resume** at 3:01am

## That's it!

No complex setup, no wrappers, no piping issues.
Just normal Claude Code usage with automatic limit handling.

## Commands Summary

- `./devflow-start.sh` - Start all services (creates `retry-claude` alias automatically)
- `claude` - Use Claude Code normally  
- `retry-claude` - Notify limit (when needed) - GLOBAL ALIAS
- `./devflow-start.sh status` - Check service status

## Global Alias

The system automatically creates a global `retry-claude` command that you can use from anywhere:
- Just type `retry-claude` instead of the full path
- Works from any directory
- Created automatically when you run `./devflow-start.sh`

**If the automatic creation fails due to permissions:**
```bash
# Run the setup script manually
./scripts/setup-retry-alias.sh

# Or create the alias manually
sudo ln -sf /Users/fulvioventura/devflow/scripts/quick-limit-notify.sh /usr/local/bin/retry-claude
```