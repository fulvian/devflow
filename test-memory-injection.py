#!/usr/bin/env python3
"""
Test diretto dell'Enhanced Memory Integration
Simulazione del processo di iniezione del contesto automatico
"""

import sys
import os
import sqlite3
from pathlib import Path

# Aggiunge il path degli hooks per importare il modulo
sys.path.append(str(Path(__file__).parent / ".claude" / "hooks"))

try:
    # Importa la classe hook
    from user_prompt_submit_context7 import UserPromptSubmitContext7Hook

    print("🧪 Test Enhanced Memory Integration")
    print("=" * 50)

    # Crea istanza del hook
    hook = UserPromptSubmitContext7Hook()

    # Test prompts in linguaggio naturale
    test_prompts = [
        "come posso migliorare le performance del sistema di database?",
        "ho bisogno di aiuto con la configurazione dei task",
        "quali sono i problemi di memory injection recentemente risolti?",
        "dammi informazioni sui cognitive memory systems",
        "come funziona l'orchestrazione degli agenti synthetic?"
    ]

    print("\n🔍 Testing keyword extraction...")
    for i, prompt in enumerate(test_prompts[:2], 1):
        keywords = hook._extract_semantic_keywords(prompt)
        print(f"{i}. '{prompt[:50]}...'")
        print(f"   Keywords: {keywords}")

    print("\n🎯 Testing memory injection...")
    for i, prompt in enumerate(test_prompts[2:4], 1):
        print(f"\n{i}. Testing prompt: '{prompt}'")

        # Test estrazione keywords
        keywords = hook._extract_semantic_keywords(prompt)
        print(f"   Keywords extracted: {keywords}")

        # Test query database
        contexts = hook._query_cometa_memory(keywords, prompt)
        print(f"   Contexts found: {len(contexts)}")

        if contexts:
            for j, context in enumerate(contexts[:2], 1):
                print(f"   {j}. {context[:100]}...")
        else:
            print("   No contexts found")

    print("\n🔧 Database connectivity test...")
    db_path = Path(__file__).parent / "data" / "devflow_unified.sqlite"
    if db_path.exists():
        with sqlite3.connect(str(db_path)) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cometa_memory_stream")
            count = cursor.fetchone()[0]
            print(f"   ✅ Database connected: {count} memory stream entries")
    else:
        print("   ❌ Database not found")

    print("\n✅ Test Enhanced Memory Integration completato")
    print("=" * 50)

except ImportError as e:
    print(f"❌ Error importing hook: {e}")
except Exception as e:
    print(f"❌ Test error: {e}")
    import traceback
    traceback.print_exc()