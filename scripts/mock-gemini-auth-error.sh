#!/usr/bin/env bash
# Mock Gemini CLI: auth error, prints known oauth mismatch to stderr and exits 2
echo "The configured auth type is oauth-personal, but the current auth type is undefined" 1>&2
exit 2

