"""
Load Testing Suite for Cometa Brain System
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 5.1 exactly
"""
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any
import sqlite3
import random
import string
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download required NLTK data (in real implementation, this would be done during setup)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

class LoadTestingSuite:
    """Complete Load Testing suite following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 5.1"""
    
    def __init__(self):
        self.db_connection = None
        self.nlp_processor = NLPProcessor()
        self.command_queue = []
        self.results = {
            'concurrent_command_processing': {},
            'nlp_processing_benchmark': {},
            'database_transaction_performance': {}
        }
    
    def setup_database(self):
        """Initialize in-memory database for testing"""
        self.db_connection = sqlite3.connect(':memory:', check_same_thread=False)
        cursor = self.db_connection.cursor()
        cursor.execute('''
            CREATE TABLE test_commands (
                id INTEGER PRIMARY KEY,
                command TEXT,
                timestamp REAL,
                processed BOOLEAN
            )
        ''')
        self.db_connection.commit()
    
    def teardown_database(self):
        """Clean up database connection"""
        if self.db_connection:
            self.db_connection.close()
    
    def generate_test_commands(self, count: int) -> List[str]:
        """Generate test commands for concurrent processing"""
        commands = []
        for i in range(count):
            command = f"COMMAND_{i}_{''.join(random.choices(string.ascii_uppercase + string.digits, k=5))}"
            commands.append(command)
        return commands
    
    def process_command(self, command: str) -> Dict[str, Any]:
        """Simulate command processing"""
        start_time = time.time()
        
        # Simulate processing time
        time.sleep(0.01)  # 10ms processing time
        
        # Process with NLP
        nlp_result = self.nlp_processor.process(command)
        
        # Store in database
        if self.db_connection:
            cursor = self.db_connection.cursor()
            cursor.execute(
                "INSERT INTO test_commands (command, timestamp, processed) VALUES (?, ?, ?)",
                (command, time.time(), True)
            )
            self.db_connection.commit()
        
        end_time = time.time()
        processing_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        return {
            'command': command,
            'processing_time_ms': processing_time,
            'nlp_result': nlp_result,
            'timestamp': end_time
        }
    
    def concurrent_command_processing_test(self, num_commands: int = 100, max_workers: int = 10) -> Dict[str, Any]:
        """Test concurrent command processing performance"""
        logger.info(f"Starting concurrent command processing test with {num_commands} commands")
        
        # Generate test commands
        commands = self.generate_test_commands(num_commands)
        
        start_time = time.time()
        results = []
        
        # Process commands concurrently
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all commands
            future_to_command = {
                executor.submit(self.process_command, command): command 
                for command in commands
            }
            
            # Collect results
            for future in as_completed(future_to_command):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as exc:
                    logger.error(f'Command generated an exception: {exc}')
        
        end_time = time.time()
        total_time = (end_time - start_time) * 1000  # Convert to milliseconds
        
        # Calculate statistics
        processing_times = [r['processing_time_ms'] for r in results]
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0
        max_processing_time = max(processing_times) if processing_times else 0
        min_processing_time = min(processing_times) if processing_times else 0
        
        # Performance assertions
        assert avg_processing_time < 100, f"Average processing time {avg_processing_time}ms exceeds 100ms threshold"
        assert max_processing_time < 100, f"Max processing time {max_processing_time}ms exceeds 100ms threshold"
        
        test_result = {
            'total_commands': num_commands,
            'total_time_ms': total_time,
            'avg_processing_time_ms': avg_processing_time,
            'max_processing_time_ms': max_processing_time,
            'min_processing_time_ms': min_processing_time,
            'throughput_commands_per_second': num_commands / (total_time / 1000),
            'passed': avg_processing_time < 100 and max_processing_time < 100
        }
        
        self.results['concurrent_command_processing'] = test_result
        logger.info(f"Concurrent command processing test completed: {test_result}")
        
        return test_result
    
    def nlp_processing_benchmark(self, iterations: int = 1000) -> Dict[str, Any]:
        """Benchmark NLP processing performance"""
        logger.info(f"Starting NLP processing benchmark with {iterations} iterations")
        
        # Test data
        test_texts = [
            "Analyze the current system performance and provide optimization recommendations",
            "Process user input and generate appropriate response based on context",
            "Execute database queries and return results in structured format",
            "Validate input parameters and handle error conditions gracefully",
            "Generate comprehensive reports with statistical analysis and visualizations"
        ]
        
        start_time = time.time()
        results = []
        
        for i in range(iterations):
            text = test_texts[i % len(test_texts)]
            result = self.nlp_processor.process(text)
            results.append(result)
        
        end_time = time.time()
        total_time = (end_time - start_time) * 1000  # Convert to milliseconds
        avg_time_per_operation = total_time / iterations
        
        # Performance assertions
        assert avg_time_per_operation < 100, f"Average NLP processing time {avg_time_per_operation}ms exceeds 100ms threshold"
        
        test_result = {
            'iterations': iterations,
            'total_time_ms': total_time,
            'avg_time_per_operation_ms': avg_time_per_operation,
            'operations_per_second': iterations / (total_time / 1000),
            'passed': avg_time_per_operation < 100
        }
        
        self.results['nlp_processing_benchmark'] = test_result
        logger.info(f"NLP processing benchmark completed: {test_result}")
        
        return test_result
    
    def database_transaction_performance_test(self, transactions: int = 1000) -> Dict[str, Any]:
        """Test database transaction performance"""
        logger.info(f"Starting database transaction performance test with {transactions} transactions")
        
        if not self.db_connection:
            self.setup_database()
        
        start_time = time.time()
        
        for i in range(transactions):
            cursor = self.db_connection.cursor()
            command = f"TEST_COMMAND_{i}_{''.join(random.choices(string.ascii_uppercase, k=3))}"
            cursor.execute(
                "INSERT INTO test_commands (command, timestamp, processed) VALUES (?, ?, ?)",
                (command, time.time(), bool(i % 2))
            )
            
            # Commit every 100 transactions to simulate realistic workload
            if i % 100 == 0:
                self.db_connection.commit()
        
        # Final commit
        self.db_connection.commit()
        
        end_time = time.time()
        total_time = (end_time - start_time) * 1000  # Convert to milliseconds
        avg_time_per_transaction = total_time / transactions
        
        # Performance assertions
        assert avg_time_per_transaction < 100, f"Average transaction time {avg_time_per_transaction}ms exceeds 100ms threshold"
        
        test_result = {
            'transactions': transactions,
            'total_time_ms': total_time,
            'avg_time_per_transaction_ms': avg_time_per_transaction,
            'transactions_per_second': transactions / (total_time / 1000),
            'passed': avg_time_per_transaction < 100
        }
        
        self.results['database_transaction_performance'] = test_result
        logger.info(f"Database transaction performance test completed: {test_result}")
        
        return test_result
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all load tests and return comprehensive results"""
        logger.info("Starting complete load testing suite")
        
        # Setup
        self.setup_database()
        
        try:
            # Run individual tests
            concurrent_result = self.concurrent_command_processing_test()
            nlp_result = self.nlp_processing_benchmark()
            db_result = self.database_transaction_performance_test()
            
            # Overall results
            all_passed = (
                concurrent_result['passed'] and 
                nlp_result['passed'] and 
                db_result['passed']
            )
            
            summary = {
                'concurrent_command_processing': concurrent_result,
                'nlp_processing_benchmark': nlp_result,
                'database_transaction_performance': db_result,
                'overall_passed': all_passed,
                'timestamp': time.time()
            }
            
            logger.info(f"Load testing suite completed. Overall result: {'PASSED' if all_passed else 'FAILED'}")
            return summary
            
        finally:
            # Cleanup
            self.teardown_database()

class NLPProcessor:
    """Simplified NLP processor for benchmarking"""
    
    def __init__(self):
        self.stemmer = PorterStemmer()
        self.stop_words = set(stopwords.words('english'))
    
    def process(self, text: str) -> Dict[str, Any]:
        """Process text with NLP operations"""
        # Tokenization
        tokens = word_tokenize(text.lower())
        
        # Remove stopwords
        filtered_tokens = [t for t in tokens if t not in self.stop_words and t.isalpha()]
        
        # Stemming
        stemmed_tokens = [self.stemmer.stem(t) for t in filtered_tokens]
        
        # Simple keyword extraction (first 3 unique stemmed words)
        keywords = list(set(stemmed_tokens))[:3]
        
        return {
            'original_text': text,
            'token_count': len(tokens),
            'filtered_token_count': len(filtered_tokens),
            'keywords': keywords
        }

def main():
    """Main function to execute the load testing suite"""
    # Create test suite instance
    test_suite = LoadTestingSuite()
    
    # Run all tests
    results = test_suite.run_all_tests()
    
    # Print results
    print("\n=== LOAD TESTING RESULTS ===")
    print(f"Overall Result: {'PASSED' if results['overall_passed'] else 'FAILED'}")
    
    for test_name, test_result in results.items():
        if isinstance(test_result, dict) and 'passed' in test_result:
            status = "PASSED" if test_result['passed'] else "FAILED"
            print(f"\n{test_name.upper()}: {status}")
            for key, value in test_result.items():
                if key != 'passed':
                    print(f"  {key}: {value}")

if __name__ == "__main__":
    main()