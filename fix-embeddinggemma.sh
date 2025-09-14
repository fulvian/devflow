#!/bin/bash
# Fix for EmbeddingGemma integration test

# First, ensure the model is available
echo "Checking if embeddinggemma model is available..."
if ! ollama list | grep -q embeddinggemma; then
    echo "Pulling embeddinggemma model..."
    ollama pull embeddinggemma
fi

# Test embedding generation using the correct API
echo "Testing embedding generation with EmbeddingGemma..."
curl -s -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "embeddinggemma",
    "prompt": "This is a test sentence for embedding generation"
  }' | grep -q "embedding" && echo "Embedding test PASSED" || echo "Embedding test FAILED"

echo "Fix completed. Use the embeddings API endpoint for generating embeddings."