"""
Test file per verificare WORKAROUND Memory Stream Monitor
Questo dovrebbe essere catturato dal monitor attivo che bypassa
i bug di Claude Code PostToolUse hook triggering.

NOTA: Questo è un test per GitHub Issues #3148, #3179, #6403, #5314
"""

def test_function():
    return "Memory stream workaround is working!"

if __name__ == "__main__":
    print(test_function())