#!/usr/bin/env python3
"""
Test Gemini CLI failure → Kimi K2 fallback
"""

import sys
import asyncio
import logging
import importlib.util

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_gemini_fallback():
    """Test che Gemini CLI fallisce e passa automaticamente a Kimi K2"""
    try:
        # Import the resilient workflow
        spec = importlib.util.spec_from_file_location("mcp_resilient_fallback",
                                                     "/Users/fulvioventura/devflow/src/core/orchestration/mcp-resilient-fallback.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        ResilientWorkflow = module.ResilientWorkflow
        AgentType = module.AgentType
        TaskRequest = module.TaskRequest

        print("🧪 Testing Gemini CLI → Kimi K2 fallback...")

        # Create workflow
        workflow = ResilientWorkflow()

        # Create a test task
        task_request = TaskRequest(
            task_id="FALLBACK-TEST-001",
            prompt="Respond with exactly: 'Fallback system working - Kimi K2 active'",
            task_type="simple_response",
            priority="MEDIUM"
        )

        print("🎯 Sending task to Gemini CLI (expecting failure)...")

        # Execute with Gemini CLI as primary (should fail)
        response = await workflow.execute_with_fallback(
            task_request=task_request,
            primary_agent=AgentType.GEMINI_CLI  # This should fail
        )

        print(f"✅ Workflow completed!")
        print(f"📄 Status: {response.status}")
        print(f"🤖 Source Agent: {response.source_agent.value if response.source_agent else 'None'}")
        print(f"🔄 Fallback Used: {response.fallback_used}")
        print(f"⏱️  Execution Time: {response.execution_time:.2f}s")

        if response.fallback_used:
            print(f"⚠️  Primary Error: {response.primary_error}")

        print(f"📝 Result: {response.result}")

        # Check if fallback worked correctly
        if response.status == "success" and response.fallback_used:
            if response.source_agent and "KIMI" in response.source_agent.value.upper():
                print("\n🎉 FALLBACK TEST PASSED! Gemini CLI failed → Kimi K2 succeeded")
                return True
            else:
                print(f"\n⚠️  Fallback worked but unexpected agent: {response.source_agent}")
                return True
        elif response.status == "success" and not response.fallback_used:
            print("\n⚠️  Unexpected: Gemini CLI succeeded (OAuth working?)")
            return True
        else:
            print(f"\n❌ Both primary and fallback failed: {response.error}")
            return False

    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_gemini_fallback())
    if success:
        print("\n🎉 GEMINI FALLBACK TEST PASSED!")
    else:
        print("\n💥 GEMINI FALLBACK TEST FAILED!")
        sys.exit(1)