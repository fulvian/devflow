#!/usr/bin/env python3
"""
Quick test for Gemini OAuth fix - Simplified version
"""

import json
import os
import time

def test_gemini_oauth_simple():
    """Test just the OAuth token retrieval part"""
    try:
        print("🧪 Testing Gemini OAuth token retrieval...")

        # Read OAuth credentials from Gemini CLI config
        oauth_creds_path = os.path.expanduser("~/.gemini/oauth_creds.json")
        if not os.path.exists(oauth_creds_path):
            print("❌ Gemini OAuth credentials not found")
            return False

        with open(oauth_creds_path, 'r') as f:
            creds = json.load(f)

        access_token = creds.get('access_token')
        if not access_token:
            print("❌ No access token found in Gemini OAuth credentials")
            return False

        # Check if token is expired
        expiry_date = creds.get('expiry_date', 0)
        current_time = time.time() * 1000  # Convert to milliseconds

        print(f"🔍 Token expiry: {expiry_date}")
        print(f"🔍 Current time: {current_time}")

        if current_time >= expiry_date:
            print("⚠️  Token is expired, would need refresh")
        else:
            print("✅ Token is still valid")

        print(f"🔑 Access token (first 20 chars): {access_token[:20]}...")

        # Check scopes
        scopes = creds.get('scope', '')
        print(f"📋 OAuth scopes: {scopes}")

        if 'cloud-platform' in scopes:
            print("✅ Has cloud-platform scope - should work for Generative Language API")
        else:
            print("⚠️  Missing cloud-platform scope")

        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

async def test_simple_api_call():
    """Test a simple API call to Gemini"""
    try:
        import aiohttp

        print("🚀 Testing direct API call to Gemini...")

        # Get token
        oauth_creds_path = os.path.expanduser("~/.gemini/oauth_creds.json")
        with open(oauth_creds_path, 'r') as f:
            creds = json.load(f)

        access_token = creds.get('access_token')

        # API call
        api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        payload = {
            'contents': [{
                'parts': [{'text': 'Respond with exactly: "Gemini OAuth fix successful!"'}]
            }]
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    print("✅ API call successful!")
                    print(f"📄 Response: {result}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ API error {response.status}: {error_text}")
                    return False

    except Exception as e:
        print(f"❌ API test failed: {e}")
        return False

if __name__ == "__main__":
    import asyncio

    print("=== GEMINI OAUTH FIX TEST ===\n")

    # Test 1: OAuth token validation
    print("1️⃣ Testing OAuth token retrieval...")
    token_ok = test_gemini_oauth_simple()

    if not token_ok:
        print("\n💥 Token test FAILED!")
        exit(1)

    # Test 2: API call
    print("\n2️⃣ Testing API call...")
    api_ok = asyncio.run(test_simple_api_call())

    if api_ok:
        print("\n🎉 Gemini OAuth fix test PASSED!")
    else:
        print("\n💥 API test FAILED!")
        exit(1)