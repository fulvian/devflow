#!/usr/bin/env python3
"""
Enhanced Context7 Trigger Testing Suite
Tests the improved hook sensitivity and triggering mechanisms based on Microsoft Kernel Memory patterns
"""
import sys
import os
from pathlib import Path
sys.path.append(str(Path(__file__).parent / ".claude" / "hooks"))

from user_prompt_submit_context7 import UserPromptSubmitContext7Hook
import json

def test_enhanced_triggers():
    """Test enhanced Context7 triggers with various prompt types"""

    # Initialize hook
    hook = UserPromptSubmitContext7Hook()

    test_cases = [
        {
            "name": "Technical Conversation (Should Auto-Trigger)",
            "prompt": "il sistema di iniezione automatico non sta funzionando. sistema non legge mai automaticamente il db cometa. analizza best practice e Context7 per migliorare hook activation e trigger sensitivity",
            "expected_trigger": True,
            "expected_score": 100
        },
        {
            "name": "Production Readiness Analysis",
            "prompt": "il sistema deve essere pronto a sostituire il sistema di contesto nativo di Claude code. verifica eventuali gap e best practice per migliorarlo",
            "expected_trigger": True,
            "expected_score": 80
        },
        {
            "name": "Microsoft Kernel Memory Discussion",
            "prompt": "use Context7 per trovare le best practice Microsoft Kernel Memory patterns e rielabora la proposta per production deployment",
            "expected_trigger": True,
            "expected_score": 120
        },
        {
            "name": "Hook Sensitivity Analysis",
            "prompt": "vanno corretti e migliorati nella sensibilità e nel triggering. hooks dovrebbero chiamare automaticamente context7 durante conversazioni tecniche",
            "expected_trigger": True,
            "expected_score": 90
        },
        {
            "name": "Database Query Issue",
            "prompt": "SQLite database queries are failing with schema mismatch errors in context_data field",
            "expected_trigger": True,
            "expected_score": 70
        },
        {
            "name": "Context Injection Enhancement",
            "prompt": "implement enhanced memory context injection using semantic analysis and relevance scoring",
            "expected_trigger": True,
            "expected_score": 100
        },
        {
            "name": "Simple Greeting (Should NOT Trigger)",
            "prompt": "hello how are you today?",
            "expected_trigger": False,
            "expected_score": 0
        },
        {
            "name": "Basic Question (Should NOT Trigger)",
            "prompt": "what time is it?",
            "expected_trigger": False,
            "expected_score": 0
        },
        {
            "name": "Architecture Discussion",
            "prompt": "we need to design a scalable architecture for enterprise deployment with vector embeddings and semantic search",
            "expected_trigger": True,
            "expected_score": 85
        },
        {
            "name": "Error Resolution",
            "prompt": "getting module not found error when importing Context7 libraries for documentation retrieval",
            "expected_trigger": True,
            "expected_score": 60
        }
    ]

    print("🚀 Enhanced Context7 Trigger Testing Suite")
    print("=" * 60)

    results = []

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[Test {i}] {test_case['name']}")
        print(f"Prompt: {test_case['prompt'][:80]}...")

        try:
            # Test Context7 detection
            context_additions = hook._detect_context7_needs(test_case['prompt'])

            # Test enhanced memory integration
            memory_contexts = hook._inject_enhanced_memory_context(test_case['prompt'])

            # Extract keywords for analysis
            keywords = hook._extract_semantic_keywords(test_case['prompt'])

            # Determine if trigger fired
            triggered = len(context_additions) > 0 or len(memory_contexts) > 0

            # Calculate approximate trigger score (simulate internal scoring)
            trigger_score = 0
            prompt_lower = test_case['prompt'].lower()

            # Technical conversation patterns
            technical_patterns = [
                'microsoft kernel memory', 'kernel memory', 'context injection',
                'production ready', 'claude code', 'hook activation',
                'automatic trigger', 'database query', 'cometa'
            ]
            for pattern in technical_patterns:
                if pattern in prompt_lower:
                    trigger_score += 100
                    break

            # Analysis patterns
            analysis_patterns = [
                'analisi', 'analysis', 'best practice', 'gap', 'improve',
                'architecture', 'system', 'implement', 'deploy'
            ]
            for pattern in analysis_patterns:
                if pattern in prompt_lower:
                    trigger_score += 60
                    break

            # Technology patterns
            if any(tech in prompt_lower for tech in ['sqlite', 'database', 'context7', 'semantic', 'vector']):
                trigger_score += 20

            # Length scoring
            if len(test_case['prompt']) > 200:
                trigger_score += 10

            # Results
            success = (triggered == test_case['expected_trigger'])

            results.append({
                'test_name': test_case['name'],
                'triggered': triggered,
                'expected_trigger': test_case['expected_trigger'],
                'calculated_score': trigger_score,
                'expected_score': test_case['expected_score'],
                'keywords_extracted': len(keywords),
                'context_injections': len(context_additions),
                'memory_injections': len(memory_contexts),
                'success': success
            })

            # Output
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"Result: {status}")
            print(f"  - Triggered: {triggered} (expected: {test_case['expected_trigger']})")
            print(f"  - Score: {trigger_score} (expected: ~{test_case['expected_score']})")
            print(f"  - Keywords: {keywords[:5]}..." if len(keywords) > 5 else f"  - Keywords: {keywords}")
            print(f"  - Context Injections: {len(context_additions)}")
            print(f"  - Memory Injections: {len(memory_contexts)}")

            if context_additions:
                print(f"  - Context: {context_additions[0][:100]}...")
            if memory_contexts:
                print(f"  - Memory: {memory_contexts[0][:100]}...")

        except Exception as e:
            print(f"❌ ERROR: {e}")
            results.append({
                'test_name': test_case['name'],
                'error': str(e),
                'success': False
            })

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    total_tests = len(results)
    passed_tests = len([r for r in results if r.get('success', False)])
    failed_tests = total_tests - passed_tests

    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {failed_tests} ❌")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")

    # Detailed analysis
    print(f"\n📈 TRIGGER ANALYSIS:")
    true_positives = len([r for r in results if r.get('triggered') == True and r.get('expected_trigger') == True])
    false_positives = len([r for r in results if r.get('triggered') == True and r.get('expected_trigger') == False])
    true_negatives = len([r for r in results if r.get('triggered') == False and r.get('expected_trigger') == False])
    false_negatives = len([r for r in results if r.get('triggered') == False and r.get('expected_trigger') == True])

    print(f"True Positives: {true_positives}")
    print(f"False Positives: {false_positives}")
    print(f"True Negatives: {true_negatives}")
    print(f"False Negatives: {false_negatives}")

    if (true_positives + false_positives) > 0:
        precision = true_positives / (true_positives + false_positives)
        print(f"Precision: {precision:.2f}")

    if (true_positives + false_negatives) > 0:
        recall = true_positives / (true_positives + false_negatives)
        print(f"Recall: {recall:.2f}")

    # Save detailed results
    with open('enhanced-context7-test-results.json', 'w') as f:
        json.dump({
            'test_summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': (passed_tests/total_tests)*100
            },
            'trigger_analysis': {
                'true_positives': true_positives,
                'false_positives': false_positives,
                'true_negatives': true_negatives,
                'false_negatives': false_negatives,
                'precision': precision if (true_positives + false_positives) > 0 else 0,
                'recall': recall if (true_positives + false_negatives) > 0 else 0
            },
            'detailed_results': results
        }, f, indent=2)

    print(f"\n💾 Detailed results saved to: enhanced-context7-test-results.json")

    return results

if __name__ == "__main__":
    test_enhanced_triggers()