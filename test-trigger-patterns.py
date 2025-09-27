#!/usr/bin/env python3
"""
Test standalone per verificare i pattern di trigger migliorati
"""
import re

def test_enhanced_trigger_patterns():
    """Test dei pattern di trigger migliorati basati su Microsoft Kernel Memory"""

    # Pattern implementati nell'hook migliorato
    analysis_patterns = [
        r'(?i)(analisi|analysis|analyze|best practice|practice|pattern|approach)',
        r'(?i)(how to|what is|explain|documentation|docs|api reference|guide)',
        r'(?i)(usage|example|tutorial|reference|implement|integration)',
        r'(?i)(error|failed|not working|issue|broken|bug|troubleshoot)',
        r'(?i)(setup|configure|install|deploy|production|ready)',
        r'(?i)(gap|missing|improve|optimize|enhance|upgrade)',
        r'(?i)(architecture|design|structure|framework|system)',
        r'(?i)(context|memory|injection|hook|trigger|activation)'
    ]

    technical_conversation_patterns = [
        r'(?i)(microsoft kernel memory|kernel memory|memory patterns)',
        r'(?i)(context injection|automatic injection|memory integration)',
        r'(?i)(production ready|enterprise|scalability|performance)',
        r'(?i)(vector embedding|semantic search|relevance scoring)',
        r'(?i)(claude code|native context|context system replacement)',
        r'(?i)(hook.*activation|trigger.*sensitivity|automatic.*trigger)',
        r'(?i)(database.*query|sqlite|cometa|memory.*stream)',
        r'(?i)(natural language|nlp|semantic.*analysis|keyword.*extraction)'
    ]

    # Test cases dalla conversazione che non ha attivato gli hook
    test_prompts = [
        {
            "prompt": "il sistema deve essere pronto, dopo opportuno periodo di rodaggio, a sostituire il sistema di contesto nativo di Claude code. così come ora strutturato? verifica eventuali gap e best practice per migliorarlo e fammi analisi e proposta migliorativa",
            "should_trigger": True,
            "description": "Production readiness analysis conversation"
        },
        {
            "prompt": "era l'occasione perfetta per testare l'attivazione degli hook che dovrebbero chiamare automaticamente context7, ma non si sono attivati!! vanno corretti e migliorati nella sensibilità e nel trigering",
            "should_trigger": True,
            "description": "Hook sensitivity discussion"
        },
        {
            "prompt": "a questo punto sulla base della tua analisi use context7 per trovare le best practice e rielabora la tua proposta",
            "should_trigger": True,
            "description": "Context7 best practice request"
        },
        {
            "prompt": "hello how are you today?",
            "should_trigger": False,
            "description": "Simple greeting"
        },
        {
            "prompt": "what time is it?",
            "should_trigger": False,
            "description": "Basic question"
        }
    ]

    print("🚀 ENHANCED TRIGGER PATTERN TESTING")
    print("=" * 60)

    results = []

    for i, test_case in enumerate(test_prompts, 1):
        prompt = test_case["prompt"]
        should_trigger = test_case["should_trigger"]

        print(f"\n[Test {i}] {test_case['description']}")
        print(f"Prompt: {prompt[:80]}...")

        # Calculate trigger score
        trigger_score = 0
        trigger_reasons = []

        # Check analysis patterns
        has_analysis_request = any(re.search(pattern, prompt) for pattern in analysis_patterns)
        if has_analysis_request:
            trigger_score += 60
            trigger_reasons.append("analysis_request")

        # Check technical conversation patterns
        has_technical_conversation = any(re.search(pattern, prompt) for pattern in technical_conversation_patterns)
        if has_technical_conversation:
            trigger_score += 100
            trigger_reasons.append("technical_conversation")

        # Check length-based scoring
        if len(prompt) > 200:
            trigger_score += 10
            trigger_reasons.append("long_prompt")

        # Technology detection
        tech_patterns = [
            r'(?i)(context7|claude|code|native|system)',
            r'(?i)(sqlite|database|cometa|memory)',
            r'(?i)(production|enterprise|hook|trigger)',
            r'(?i)(microsoft|kernel|semantic|analysis)'
        ]

        mentioned_techs = []
        for pattern in tech_patterns:
            matches = re.findall(pattern, prompt, re.IGNORECASE)
            mentioned_techs.extend(matches)

        if len(mentioned_techs) >= 2:
            trigger_score += 40
            trigger_reasons.append("multiple_technologies")
        elif len(mentioned_techs) >= 1:
            trigger_score += 20
            trigger_reasons.append("single_technology")

        # Decision threshold
        activation_threshold = 50
        triggered = trigger_score >= activation_threshold

        # Evaluate result
        success = (triggered == should_trigger)
        status = "✅ PASS" if success else "❌ FAIL"

        print(f"Result: {status}")
        print(f"  - Score: {trigger_score} (threshold: {activation_threshold})")
        print(f"  - Triggered: {triggered} (expected: {should_trigger})")
        print(f"  - Reasons: {', '.join(trigger_reasons)}")
        print(f"  - Technologies: {mentioned_techs[:5]}...")
        print(f"  - Analysis Pattern: {has_analysis_request}")
        print(f"  - Technical Pattern: {has_technical_conversation}")

        results.append({
            'test': i,
            'description': test_case['description'],
            'trigger_score': trigger_score,
            'triggered': triggered,
            'expected': should_trigger,
            'success': success,
            'reasons': trigger_reasons
        })

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    total = len(results)
    passed = len([r for r in results if r['success']])
    failed = total - passed

    print(f"Total Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {failed} ❌")
    print(f"Success Rate: {(passed/total)*100:.1f}%")

    if failed > 0:
        print(f"\nFailed tests:")
        for result in results:
            if not result['success']:
                print(f"  - Test {result['test']}: {result['description']}")
                print(f"    Expected: {result['expected']}, Got: {result['triggered']} (Score: {result['trigger_score']})")

    return results

if __name__ == "__main__":
    test_enhanced_trigger_patterns()