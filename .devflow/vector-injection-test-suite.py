#!/usr/bin/env python3
"""
Vector Injection Test Suite - DevFlow Context System
Test 20 diversi scenari di complessità per valutare l'efficacia dell'iniezione di contesto vettoriale
"""

import json
import time
import subprocess
import sqlite3
from typing import List, Dict, Any
from pathlib import Path

class VectorInjectionTestSuite:
    def __init__(self, db_path: str = "data/devflow_unified.sqlite"):
        self.db_path = Path(db_path)
        self.test_results = []

    def simulate_user_query(self, query: str, test_id: int, complexity: str) -> Dict[str, Any]:
        """Simula una query utente e cattura il risultato dell'iniezione di contesto"""
        start_time = time.time()

        # Simula il trigger del hook (scrive file temporaneo che simula user input)
        temp_query_file = f"/tmp/devflow_test_query_{test_id}.txt"
        with open(temp_query_file, "w") as f:
            f.write(query)

        # Simula l'attivazione del sistema di iniezione tramite hook test
        try:
            result = subprocess.run([
                "python3",
                "/Users/fulvioventura/devflow/.claude/hooks/enhanced-memory-integration.py",
                "--test-mode",
                "--query", query
            ], capture_output=True, text=True, timeout=30)

            injection_successful = result.returncode == 0
            context_score = self._extract_score_from_output(result.stdout)
            contexts_injected = self._extract_contexts_from_output(result.stdout)

        except subprocess.TimeoutExpired:
            injection_successful = False
            context_score = 0
            contexts_injected = 0
        except Exception as e:
            injection_successful = False
            context_score = 0
            contexts_injected = 0

        execution_time = time.time() - start_time

        return {
            "test_id": test_id,
            "query": query,
            "complexity": complexity,
            "injection_successful": injection_successful,
            "context_score": context_score,
            "contexts_injected": contexts_injected,
            "execution_time_ms": round(execution_time * 1000, 2),
            "timestamp": time.time()
        }

    def _extract_score_from_output(self, output: str) -> int:
        """Estrae lo score dai log di output"""
        try:
            if "Score:" in output:
                score_line = [line for line in output.split('\n') if 'Score:' in line][0]
                return int(score_line.split('Score:')[1].strip().split()[0])
        except:
            pass
        return 0

    def _extract_contexts_from_output(self, output: str) -> int:
        """Estrae il numero di contesti iniettati"""
        try:
            if "Contexts:" in output:
                contexts_line = [line for line in output.split('\n') if 'Contexts:' in line][0]
                return int(contexts_line.split('Contexts:')[1].strip().split()[0])
        except:
            pass
        return 0

    def run_test_suite(self) -> List[Dict[str, Any]]:
        """Esegue la suite completa di 20 test"""

        test_queries = [
            # COMPLESSITÀ BASSA (1-5)
            ("database", 1, "low"),
            ("hook system", 2, "low"),
            ("embedding process", 3, "low"),
            ("vector search", 4, "low"),
            ("context injection", 5, "low"),

            # COMPLESSITÀ MEDIA (6-10)
            ("come funziona il sistema di orchestration", 6, "medium"),
            ("analizza le performance del daemon", 7, "medium"),
            ("integrazione tra cometa brain e devflow", 8, "medium"),
            ("processo di validazione dei task", 9, "medium"),
            ("gestione automatica degli embedding", 10, "medium"),

            # COMPLESSITÀ ALTA (11-15)
            ("implementazione completa dell'architettura context7 con pattern semantici", 11, "high"),
            ("ottimizzazione del rate limiting per il processing massivo di embeddings", 12, "high"),
            ("analisi cross-verificata dei daemon con fallback automatico su synthetic", 13, "high"),
            ("protocollo di enforcement delle regole con penalty system graduato", 14, "high"),
            ("integrazione unified orchestrator con api selection dinamica", 15, "high"),

            # COMPLESSITÀ MOLTO ALTA (16-20)
            ("debugging sistematico del processo end-to-end di creazione embedding con rollback automatico", 16, "very_high"),
            ("implementazione pattern context7 con vector injection semantico e cross-verification", 17, "very_high"),
            ("orchestrazione completa multi-agent con fallback chain e performance monitoring realtime", 18, "very_high"),
            ("sistema di audit trail completo con cryptographic integrity e penalty escalation", 19, "very_high"),
            ("architettura completa devflow con enforcement rules, database management e anti-circumvention", 20, "very_high")
        ]

        print(f"🧪 Avvio Test Suite Vector Injection - 20 scenari")
        print(f"📊 Database: {self.db_path}")
        print(f"⏱️ Inizio esecuzione: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)

        for query, test_id, complexity in test_queries:
            print(f"\n🔍 Test {test_id:2d}/20 [{complexity:9s}]: {query[:50]}...")
            result = self.simulate_user_query(query, test_id, complexity)
            self.test_results.append(result)

            # Feedback immediato
            status = "✅" if result["injection_successful"] else "❌"
            print(f"   {status} Score: {result['context_score']:3d} | Contexts: {result['contexts_injected']:2d} | Time: {result['execution_time_ms']:6.1f}ms")

            # Pausa per evitare rate limiting
            time.sleep(0.5)

        return self.test_results

    def generate_comprehensive_report(self) -> Dict[str, Any]:
        """Genera report completo con metriche avanzate"""

        if not self.test_results:
            return {"error": "No test results available"}

        # Metriche per complessità
        complexity_stats = {}
        for complexity in ["low", "medium", "high", "very_high"]:
            tests = [t for t in self.test_results if t["complexity"] == complexity]
            if tests:
                complexity_stats[complexity] = {
                    "count": len(tests),
                    "success_rate": sum(t["injection_successful"] for t in tests) / len(tests),
                    "avg_score": sum(t["context_score"] for t in tests) / len(tests),
                    "avg_contexts": sum(t["contexts_injected"] for t in tests) / len(tests),
                    "avg_time_ms": sum(t["execution_time_ms"] for t in tests) / len(tests)
                }

        # Metriche globali
        total_tests = len(self.test_results)
        successful_tests = sum(t["injection_successful"] for t in self.test_results)
        total_score = sum(t["context_score"] for t in self.test_results)
        total_contexts = sum(t["contexts_injected"] for t in self.test_results)
        total_time = sum(t["execution_time_ms"] for t in self.test_results)

        # Performance tiers
        high_performance = len([t for t in self.test_results if t["context_score"] >= 50])
        medium_performance = len([t for t in self.test_results if 20 <= t["context_score"] < 50])
        low_performance = len([t for t in self.test_results if 5 <= t["context_score"] < 20])
        failed_performance = len([t for t in self.test_results if t["context_score"] < 5])

        return {
            "test_execution": {
                "total_tests": total_tests,
                "successful_injections": successful_tests,
                "success_rate_percent": round((successful_tests / total_tests) * 100, 1),
                "total_execution_time_ms": round(total_time, 1),
                "avg_execution_time_ms": round(total_time / total_tests, 1)
            },
            "context_injection_quality": {
                "total_score": total_score,
                "average_score": round(total_score / total_tests, 1),
                "total_contexts_injected": total_contexts,
                "avg_contexts_per_query": round(total_contexts / total_tests, 1)
            },
            "performance_distribution": {
                "high_performance": {"count": high_performance, "percentage": round((high_performance/total_tests)*100, 1)},
                "medium_performance": {"count": medium_performance, "percentage": round((medium_performance/total_tests)*100, 1)},
                "low_performance": {"count": low_performance, "percentage": round((low_performance/total_tests)*100, 1)},
                "failed_performance": {"count": failed_performance, "percentage": round((failed_performance/total_tests)*100, 1)}
            },
            "complexity_analysis": complexity_stats,
            "detailed_results": self.test_results,
            "recommendations": self._generate_recommendations()
        }

    def _generate_recommendations(self) -> List[str]:
        """Genera raccomandazioni basate sui risultati"""
        recommendations = []

        if not self.test_results:
            return ["No test data available for recommendations"]

        success_rate = sum(t["injection_successful"] for t in self.test_results) / len(self.test_results)
        avg_score = sum(t["context_score"] for t in self.test_results) / len(self.test_results)
        avg_time = sum(t["execution_time_ms"] for t in self.test_results) / len(self.test_results)

        if success_rate < 0.8:
            recommendations.append("⚠️ Success rate < 80% - Verificare configurazione hook system")

        if avg_score < 20:
            recommendations.append("📈 Score medio basso - Ottimizzare algoritmo vector search")

        if avg_time > 1000:
            recommendations.append("⚡ Tempi esecuzione elevati - Ottimizzare performance database")

        # Analisi per complessità
        very_high_tests = [t for t in self.test_results if t["complexity"] == "very_high"]
        if very_high_tests:
            very_high_success = sum(t["injection_successful"] for t in very_high_tests) / len(very_high_tests)
            if very_high_success < 0.6:
                recommendations.append("🎯 Query complesse hanno bassa success rate - Migliorare semantic matching")

        if avg_score >= 50:
            recommendations.append("✅ Sistema performing eccellente - Considerare aumento soglie qualità")

        if success_rate >= 0.95:
            recommendations.append("🚀 Sistema altamente affidabile - Ready for production")

        return recommendations if recommendations else ["✅ Sistema ottimale - Nessuna raccomandazione specifica"]

if __name__ == "__main__":
    test_suite = VectorInjectionTestSuite()
    results = test_suite.run_test_suite()
    report = test_suite.generate_comprehensive_report()

    # Salva report
    report_file = "/Users/fulvioventura/devflow/.devflow/vector-injection-test-report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n📊 Report salvato in: {report_file}")