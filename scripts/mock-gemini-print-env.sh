#!/usr/bin/env bash
# Mock Gemini CLI: prints selected envs and exits 0
echo "GEMINI_API_KEY=${GEMINI_API_KEY:-<unset>}"
echo "GOOGLE_API_KEY=${GOOGLE_API_KEY:-<unset>}"
echo "GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-<unset>}"
exit 0

