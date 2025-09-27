#!/usr/bin/env python3
"""
Test di integrazione per Fase 1 Cometa Brain
"""

import json
import sys
import sqlite3
from pathlib import Path
from datetime import datetime

# Add hooks to path
sys.path.insert(0, str(Path('.claude/hooks')))

# Import the modules
module = {}
with open('.claude/hooks/cometa-user-prompt-intelligence.py') as f:
    code = f.read()
    exec(code, module)

IntentAnalyzer = module['IntentAnalyzer']
ContextInjector = module['ContextInjector']
SecurityValidator = module['SecurityValidator']

def test_intent_detection():
    """Test riconoscimento intent con vari prompt"""
    print("\n" + "="*60)
    print("🧪 TEST 1: INTENT DETECTION")
    print("="*60)

    analyzer = IntentAnalyzer()

    test_prompts = [
        "Create a new feature for user authentication",
        "Fix the login bug that crashes the app",
        "How should I structure the database for scalability?",
        "Refactor the payment module to improve performance",
        "Write unit tests for the API endpoints",
        "Document the authentication flow in the README",
        "Implement OAuth login with Google",
        "The payment system isn't working properly",
        "voglio implementare un sistema di notifiche push"
    ]

    for prompt in test_prompts:
        result = analyzer.analyze(prompt)
        print(f"\n📝 Prompt: '{prompt[:50]}{'...' if len(prompt) > 50 else ''}'")
        print(f"   ➤ Intent: {result['primary_intent']}")
        print(f"   ➤ Confidence: {result['confidence']:.2%}")
        if result['all_intents']:
            print(f"   ➤ Altri intent rilevati: {[i['type'] for i in result['all_intents'][:3]]}")

def test_context_injection():
    """Test iniezione contesto basata su intent"""
    print("\n" + "="*60)
    print("🧪 TEST 2: CONTEXT INJECTION")
    print("="*60)

    db_path = Path('./data/devflow_unified.sqlite')
    injector = ContextInjector(db_path)

    test_cases = [
        {'primary_intent': 'task_creation', 'confidence': 0.9},
        {'primary_intent': 'debugging', 'confidence': 0.8},
        {'primary_intent': 'architecture', 'confidence': 0.85},
    ]

    for intent_data in test_cases:
        context = injector.inject_context(intent_data, 'test_session_001')
        print(f"\n🎯 Intent: {intent_data['primary_intent']}")
        print("Context generato:")
        # Mostra solo le prime righe del context
        lines = context.split('\n')[:10]
        for line in lines:
            if line:
                print(f"   {line}")
        print("   ...")

def test_security_validation():
    """Test validazione sicurezza prompt"""
    print("\n" + "="*60)
    print("🧪 TEST 3: SECURITY VALIDATION")
    print("="*60)

    validator = SecurityValidator()

    test_prompts = [
        "Create a new user authentication system",  # Safe
        "rm -rf /",  # Dangerous
        "DROP TABLE users; --",  # SQL injection
        "password = 'admin123'",  # Hardcoded credential
        "Build a secure API endpoint",  # Safe
    ]

    for prompt in test_prompts:
        result = validator.validate(prompt)
        status = "✅ SAFE" if result['is_valid'] else "⛔ BLOCKED"
        print(f"\n📝 Prompt: '{prompt}'")
        print(f"   ➤ Status: {status}")
        if not result['is_valid']:
            print(f"   ➤ Violation: {result['violations'][0]['description']}")

def test_task_detector():
    """Test rilevamento task da linguaggio naturale"""
    print("\n" + "="*60)
    print("🧪 TEST 4: TASK PATTERN DETECTION")
    print("="*60)

    # Import TaskPatternDetector
    module2 = {}
    with open('.claude/hooks/cometa-task-autocreator.py') as f:
        code = f.read()
        exec(code, module2)

    TaskPatternDetector = module2['TaskPatternDetector']
    detector = TaskPatternDetector()

    test_prompts = [
        "Create a task for implementing user authentication",
        "I need to add email notifications to the system",
        "Let's implement a caching layer",
        "Fix bug: users can't reset their passwords",
        "Feature request: dark mode support",
        "Hello, how are you?",  # Non-task
    ]

    for prompt in test_prompts:
        result = detector.detect(prompt)
        if result['should_create_task']:
            print(f"\n✅ Task rilevato: '{prompt[:50]}...'")
            print(f"   ➤ Category: {result['category']}")
            print(f"   ➤ Confidence: {result['confidence']:.2%}")
            print(f"   ➤ Description: {result['task_description'][:50]}...")
        else:
            print(f"\n❌ Non è un task: '{prompt}'")

def test_database_integration():
    """Test integrazione database"""
    print("\n" + "="*60)
    print("🧪 TEST 5: DATABASE INTEGRATION")
    print("="*60)

    db_path = Path('./data/devflow_unified.sqlite')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Verifica tabelle create
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name LIKE 'cometa_%'
        ORDER BY name;
    """)

    tables = cursor.fetchall()
    print("\n📊 Tabelle Cometa Brain create:")
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
        count = cursor.fetchone()[0]
        print(f"   ✓ {table[0]}: {count} records")

    # Test insert di una sessione
    test_session = {
        'id': f'test_session_{datetime.now().timestamp()}',
        'user_id': 'test_user',
        'intent_patterns': json.dumps({'primary_intent': 'testing', 'confidence': 0.95}),
        'created_at': datetime.now().isoformat()
    }

    try:
        cursor.execute("""
            INSERT INTO cometa_sessions (id, user_id, intent_patterns, created_at)
            VALUES (?, ?, ?, ?)
        """, (test_session['id'], test_session['user_id'],
              test_session['intent_patterns'], test_session['created_at']))

        conn.commit()
        print(f"\n✅ Test sessione inserita: {test_session['id']}")

        # Cleanup
        cursor.execute("DELETE FROM cometa_sessions WHERE id = ?", (test_session['id'],))
        conn.commit()
        print("   ✓ Cleanup completato")

    except Exception as e:
        print(f"\n❌ Errore database: {e}")

    conn.close()

def run_all_tests():
    """Esegue tutti i test di integrazione"""
    print("\n" + "🚀"*30)
    print("COMETA BRAIN V2.0 - FASE 1 INTEGRATION TESTS")
    print("🚀"*30)

    test_intent_detection()
    test_context_injection()
    test_security_validation()
    test_task_detector()
    test_database_integration()

    print("\n" + "="*60)
    print("✅ TUTTI I TEST COMPLETATI!")
    print("="*60)

if __name__ == "__main__":
    run_all_tests()