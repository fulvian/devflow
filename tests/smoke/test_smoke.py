"""
Smoke Tests for Cometa Brain Service

Implements complete Smoke Tests following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 10.1 exactly.
Tests service health, basic command processing, and database connectivity.
"""

import os
import sys
import asyncio
import logging
from typing import Dict, Any, Optional
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SmokeTestError(Exception):
    """Custom exception for smoke test failures"""
    pass

class CometaBrainSmokeTests:
    """
    Smoke tests for Cometa Brain service validation.
    
    Tests include:
    1. Service health check
    2. Basic command processing
    3. Database connectivity
    """
    
    def __init__(self):
        """Initialize smoke test suite with configuration from environment variables."""
        self.service_url = os.getenv('COMETA_BRAIN_URL', 'http://localhost:8000')
        self.health_endpoint = f"{self.service_url}/health"
        self.command_endpoint = f"{self.service_url}/process"
        self.db_check_endpoint = f"{self.service_url}/db-status"
        self.timeout = int(os.getenv('SMOKE_TEST_TIMEOUT', '30'))
        
        # HTTP client for tests
        self.client = httpx.AsyncClient(timeout=self.timeout)
        
    async def test_service_health(self) -> bool:
        """
        Test 1: Service Health Check
        
        Verifies that the Cometa Brain service is running and responding to health checks.
        
        Returns:
            bool: True if health check passes, False otherwise
            
        Raises:
            SmokeTestError: If health check fails with unexpected error
        """
        logger.info("Running Service Health Test...")
        
        try:
            response = await self.client.get(self.health_endpoint)
            
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get('status') == 'healthy':
                    logger.info("✓ Service Health Test PASSED")
                    return True
                else:
                    logger.error(f"✗ Service Health Test FAILED: Unexpected status - {health_data}")
                    return False
            else:
                logger.error(f"✗ Service Health Test FAILED: HTTP {response.status_code}")
                return False
                
        except httpx.TimeoutException:
            logger.error("✗ Service Health Test FAILED: Request timeout")
            return False
        except httpx.RequestError as e:
            logger.error(f"✗ Service Health Test FAILED: Request error - {str(e)}")
            return False
        except Exception as e:
            logger.error(f"✗ Service Health Test FAILED: Unexpected error - {str(e)}")
            raise SmokeTestError(f"Health check failed: {str(e)}")
    
    async def test_command_processing(self) -> bool:
        """
        Test 2: Basic Command Processing
        
        Verifies that the service can process basic commands correctly.
        
        Returns:
            bool: True if command processing works, False otherwise
            
        Raises:
            SmokeTestError: If command processing fails with unexpected error
        """
        logger.info("Running Basic Command Processing Test...")
        
        test_command = {
            "command": "echo",
            "parameters": {
                "message": "smoke test"
            }
        }
        
        try:
            response = await self.client.post(
                self.command_endpoint,
                json=test_command,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result_data = response.json()
                if result_data.get('status') == 'success':
                    logger.info("✓ Basic Command Processing Test PASSED")
                    return True
                else:
                    logger.error(f"✗ Basic Command Processing Test FAILED: {result_data}")
                    return False
            else:
                logger.error(f"✗ Basic Command Processing Test FAILED: HTTP {response.status_code}")
                return False
                
        except httpx.TimeoutException:
            logger.error("✗ Basic Command Processing Test FAILED: Request timeout")
            return False
        except httpx.RequestError as e:
            logger.error(f"✗ Basic Command Processing Test FAILED: Request error - {str(e)}")
            return False
        except Exception as e:
            logger.error(f"✗ Basic Command Processing Test FAILED: Unexpected error - {str(e)}")
            raise SmokeTestError(f"Command processing failed: {str(e)}")
    
    async def test_database_connectivity(self) -> bool:
        """
        Test 3: Database Connectivity
        
        Verifies that the service can connect to its database.
        
        Returns:
            bool: True if database connectivity is working, False otherwise
            
        Raises:
            SmokeTestError: If database check fails with unexpected error
        """
        logger.info("Running Database Connectivity Test...")
        
        try:
            response = await self.client.get(self.db_check_endpoint)
            
            if response.status_code == 200:
                db_data = response.json()
                if db_data.get('connected') is True:
                    logger.info("✓ Database Connectivity Test PASSED")
                    return True
                else:
                    logger.error(f"✗ Database Connectivity Test FAILED: Not connected - {db_data}")
                    return False
            else:
                logger.error(f"✗ Database Connectivity Test FAILED: HTTP {response.status_code}")
                return False
                
        except httpx.TimeoutException:
            logger.error("✗ Database Connectivity Test FAILED: Request timeout")
            return False
        except httpx.RequestError as e:
            logger.error(f"✗ Database Connectivity Test FAILED: Request error - {str(e)}")
            return False
        except Exception as e:
            logger.error(f"✗ Database Connectivity Test FAILED: Unexpected error - {str(e)}")
            raise SmokeTestError(f"Database connectivity check failed: {str(e)}")
    
    async def run_all_tests(self) -> bool:
        """
        Run all smoke tests in sequence.
        
        Returns:
            bool: True if all tests pass, False if any test fails
        """
        logger.info("Starting Cometa Brain Smoke Tests...")
        
        test_results = []
        
        # Run tests in order
        try:
            # Test 1: Service Health
            health_result = await self.test_service_health()
            test_results.append(health_result)
            
            # Test 2: Command Processing
            command_result = await self.test_command_processing()
            test_results.append(command_result)
            
            # Test 3: Database Connectivity
            db_result = await self.test_database_connectivity()
            test_results.append(db_result)
            
            # Check if all tests passed
            all_passed = all(test_results)
            
            if all_passed:
                logger.info("🎉 All Smoke Tests PASSED")
            else:
                logger.error("❌ Some Smoke Tests FAILED")
                
            return all_passed
            
        except SmokeTestError as e:
            logger.error(f"Smoke tests failed with error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during smoke tests: {str(e)}")
            return False
    
    async def cleanup(self):
        """Clean up resources after tests."""
        await self.client.aclose()

async def main():
    """
    Main entry point for smoke tests.
    
    Returns:
        int: 0 if all tests pass, 1 if any test fails
    """
    smoke_tests = CometaBrainSmokeTests()
    
    try:
        success = await smoke_tests.run_all_tests()
        return 0 if success else 1
    finally:
        await smoke_tests.cleanup()

if __name__ == "__main__":
    # Run the smoke tests
    result = asyncio.run(main())
    sys.exit(result)